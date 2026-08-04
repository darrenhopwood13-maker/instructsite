import { useCallback, useState } from "react";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, X, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  registerTier1Document,
  splitAndRegisterDrawingPack,
  checkDrawingPackDuplicate,
} from "@/lib/tier1-uploads.functions";
import { findDuplicateDocument } from "@/lib/document-lifecycle.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

type Item = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "extracting" | "done" | "error";
  detail?: string;
  error?: string;
};

const BUCKET = "project-bible";

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Props {
  projectId: string;
  docType: "drawing" | "logistics" | "rams";
  title: string;
  subtitle: string;
  accent?: "orange" | "white";
  extraFields?: {
    tradePackage?: string;
    highRiskFlags?: string[];
    permitRequired?: boolean;
  };
  /** When set, disables the drop input and shows the reason. */
  disabledReason?: string;
  /** Stable hook for the live guided tour spotlight. */
  dataTour?: string;
  onUploaded?: () => void;
}


type PendingDup = {
  file: File;
  hash: string;
  matches: { id: string; fileName: string; createdAt: string | null }[];
  resolve: (choice: "revision" | "separate" | "cancel", supersedesId?: string) => void;
};

type PendingPackDup = {
  packName: string;
  sheetCount: number;
  resolve: (choice: "replace" | "keep_both" | "cancel") => void;
};

export function DropZone({
  projectId,
  docType,
  title,
  subtitle,
  accent = "orange",
  extraFields,
  disabledReason,
  dataTour,
  onUploaded,
}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dup, setDup] = useState<PendingDup | null>(null);
  const register = useServerFn(registerTier1Document);
  const splitPack = useServerFn(splitAndRegisterDrawingPack);
  const findDup = useServerFn(findDuplicateDocument);
  const checkPackDup = useServerFn(checkDrawingPackDuplicate);
  const [packDup, setPackDup] = useState<PendingPackDup | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((p) => [{ id, name: file.name, size: file.size, status: "uploading" }, ...p]);
      try {
        const user = await ensureOracleSession();
        const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");

        // Duplicate detection — skip for multi-sheet drawing packs (they're
        // split server-side into per-sheet rows so hash matching would be
        // misleading).
        let supersedesId: string | undefined;
        let contentHash: string | undefined;
        if (!(docType === "drawing" && isPdf)) {
          try {
            contentHash = await sha256Hex(file);
            const res = await findDup({ data: { projectId, contentHash } });
            if (res.matches.length > 0) {
              const choice = await new Promise<{
                mode: "revision" | "separate" | "cancel";
                supersedesId?: string;
              }>((resolve) => {
                setDup({
                  file,
                  hash: contentHash!,
                  matches: res.matches,
                  resolve: (mode, sid) => {
                    setDup(null);
                    resolve({ mode, supersedesId: sid });
                  },
                });
              });
              if (choice.mode === "cancel") {
                setItems((p) => p.filter((x) => x.id !== id));
                return;
              }
              if (choice.mode === "revision") supersedesId = choice.supersedesId;
            }
          } catch {
            /* hashing / lookup failures shouldn't block the upload */
          }
        }

        // === DRAWING + PDF → server-side pdf-lib split + Gemini extraction ===
        if (docType === "drawing" && isPdf) {
          // De-dup: warn before silently registering the same pack twice.
          let duplicatePolicy: "replace" | "keep_both" | undefined;
          try {
            const dupRes = await checkPackDup({ data: { projectId, packName: file.name } });
            if (dupRes.matches.length > 0) {
              const choice = await new Promise<"replace" | "keep_both" | "cancel">((resolve) => {
                setPackDup({
                  packName: file.name,
                  sheetCount: dupRes.matches.length,
                  resolve: (c) => {
                    setPackDup(null);
                    resolve(c);
                  },
                });
              });
              if (choice === "cancel") {
                setItems((p) => p.filter((x) => x.id !== id));
                return;
              }
              duplicatePolicy = choice;
            }
          } catch {
            /* a failed pre-check must never block the upload */
          }

          const rawPath = `${user.id}/${projectId}/raw_incoming_packs/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(rawPath, file, { contentType: "application/pdf", upsert: false });
          if (upErr) throw upErr;

          setItems((p) =>
            p.map((i) =>
              i.id === id
                ? { ...i, status: "extracting", detail: "Oracle splitting pack & reading every sheet…" }
                : i,
            ),
          );

          const res = await splitPack({
            data: { projectId, packName: file.name, rawFilePath: rawPath, duplicatePolicy },
          });

          setItems((p) =>
            p.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: res.completed === 0 && res.failed > 0 ? "error" : "done",
                    detail: `${res.completed}/${res.totalPages} sheets parsed${res.failed ? ` · ${res.failed} failed` : ""}`,
                    error: res.completed === 0 && res.failed > 0 ? "Extraction failed" : undefined,
                  }
                : i,
            ),
          );
          onUploaded?.();
          return;
        }


        // === Standard single-file flow ===
        const path = `${user.id}/${projectId}/${docType}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        setItems((p) => p.map((i) => (i.id === id ? { ...i, status: "extracting" } : i)));

        const res = await register({
          data: {
            projectId,
            docType,
            fileName: file.name,
            filePath: path,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            tradePackage: extraFields?.tradePackage,
            highRiskFlags: extraFields?.highRiskFlags as any,
            permitRequired: extraFields?.permitRequired,
            contentHash,
            supersedesSiteDocumentId: supersedesId,
          },
        });

        if (res.extractionStatus === "failed") {
          throw new Error(res.extractionError ?? "Extraction failed");
        }

        setItems((p) =>
          p.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "done",
                  detail: supersedesId
                    ? "Uploaded as new revision · prior version archived"
                    : res.extractionStatus === "complete"
                      ? "Parsed & indexed"
                      : "Uploaded (no readable text)",
                }
              : i,
          ),
        );
        onUploaded?.();
      } catch (err) {
        setItems((p) =>
          p.map((i) =>
            i.id === id
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
              : i,
          ),
        );
      }
    },
    [checkPackDup, docType, extraFields, findDup, onUploaded, projectId, register, splitPack],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    if (disabledReason) return;
    Array.from(files).forEach((f) => void uploadFile(f));
  };

  const borderColor =
    accent === "orange"
      ? dragging
        ? "border-alert"
        : "border-alert/40"
      : dragging
        ? "border-white"
        : "border-white/25";

  return (
    <div className="glass-panel p-6" data-tour={dataTour}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-alert">
            {docType === "drawing"
              ? "GA / Drawings"
              : docType === "logistics"
                ? "Site Logistics"
                : "Master RAMS"}
          </p>
          <h3
            className="mt-1 text-xl font-extrabold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            {title}
          </h3>
          <p className="mt-1 text-xs text-foreground/60">{subtitle}</p>
        </div>
      </div>

      {disabledReason && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md border border-amber-400/60 bg-amber-400/10 px-2 py-1.5 text-[0.65rem] uppercase tracking-widest text-amber-300">
          <AlertTriangle size={12} /> {disabledReason}
        </p>
      )}

      <label
        onDragOver={(e) => {
          if (disabledReason) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed ${borderColor} bg-black/20 p-6 text-center transition-colors ${disabledReason ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <div className="glass-accent flex h-12 w-12 items-center justify-center">
          <UploadCloud size={22} />
        </div>
        <div className="text-sm font-bold uppercase tracking-wider text-foreground">
          Drop files or click to browse
        </div>
        <div className="text-[0.7rem] uppercase tracking-widest text-foreground/50">
          PDF · Image · Photo · Doc · CAD — multi-file
        </div>
        <input
          type="file"
          multiple
          disabled={!!disabledReason}
          accept="application/pdf,image/*,.heic,.heif,.txt,.csv,.tsv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.rvt,.ifc,.xml,.json"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-md border border-white/10 bg-black/30 p-2.5"
            >
              <FileText size={16} className="text-foreground/70" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-mono text-foreground">{it.name}</div>
                <div className="text-[0.65rem] uppercase tracking-widest text-foreground/50">
                  {fmt(it.size)}
                  {it.detail ? ` · ${it.detail}` : ""}
                  {it.status === "error" && it.error ? ` · ${it.error}` : ""}
                </div>
              </div>
              {(it.status === "uploading" || it.status === "extracting") && (
                <Loader2 size={14} className="animate-spin text-foreground/60" />
              )}
              {it.status === "done" && <CheckCircle2 size={14} className="text-emerald-400" />}
              {it.status === "error" && <AlertCircle size={14} className="text-alert" />}
              <button
                type="button"
                onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                className="text-foreground/40 hover:text-foreground"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {packDup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
        >
          <div className="glass-panel w-full max-w-md border-2 border-alert p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-alert" size={18} />
              <h3 className="text-lg font-extrabold uppercase tracking-wider text-alert">
                Sheet already exists
              </h3>
            </div>
            <p className="mt-2 text-xs text-foreground/70">
              <span className="font-mono">{packDup.packName}</span> is already registered on this
              project with {packDup.sheetCount} sheet{packDup.sheetCount === 1 ? "" : "s"}.
              Uploading again will create a second copy of every sheet.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => packDup.resolve("replace")}
                className="btn-primary rounded-md px-3 py-2 text-xs uppercase tracking-widest"
              >
                Replace existing sheets
              </button>
              <button
                type="button"
                onClick={() => packDup.resolve("keep_both")}
                className="rounded-md border border-white/20 px-3 py-2 text-xs uppercase tracking-widest text-foreground/80 hover:border-white/40"
              >
                Keep both
              </button>
              <button
                type="button"
                onClick={() => packDup.resolve("cancel")}
                className="rounded-md px-3 py-2 text-[0.65rem] uppercase tracking-widest text-foreground/50 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {dup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
        >
          <div className="glass-panel w-full max-w-md border-2 border-alert p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-alert" size={18} />
              <h3 className="text-lg font-extrabold uppercase tracking-wider text-alert">
                Duplicate detected
              </h3>
            </div>
            <p className="mt-2 text-xs text-foreground/70">
              An identical file is already in this project's bible:
            </p>
            <ul className="mt-2 space-y-1 rounded-md border border-white/10 bg-black/40 p-2 text-[0.7rem] font-mono text-foreground/80">
              {dup.matches.slice(0, 5).map((m) => (
                <li key={m.id} className="truncate">
                  {m.fileName}
                  {m.createdAt ? ` · ${new Date(m.createdAt).toLocaleDateString()}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.7rem] text-foreground/60">
              Replace the previous version as a new revision (the old file is archived, not
              deleted), or upload this as a separate document alongside it?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => dup.resolve("revision", dup.matches[0].id)}
                className="btn-primary rounded-md px-3 py-2 text-xs uppercase tracking-widest"
              >
                Replace as new revision
              </button>
              <button
                type="button"
                onClick={() => dup.resolve("separate")}
                className="rounded-md border border-white/20 px-3 py-2 text-xs uppercase tracking-widest text-foreground/80 hover:border-white/40"
              >
                Upload as separate document
              </button>
              <button
                type="button"
                onClick={() => dup.resolve("cancel")}
                className="rounded-md px-3 py-2 text-[0.65rem] uppercase tracking-widest text-foreground/50 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
