import { useCallback, useState } from "react";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerTier1Document, splitAndRegisterDrawingPack } from "@/lib/tier1-uploads.functions";
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
  onUploaded?: () => void;
}

export function DropZone({
  projectId,
  docType,
  title,
  subtitle,
  accent = "orange",
  extraFields,
  onUploaded,
}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const register = useServerFn(registerTier1Document);
  const splitPack = useServerFn(splitAndRegisterDrawingPack);

  const uploadFile = useCallback(
    async (file: File) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((p) => [{ id, name: file.name, size: file.size, status: "uploading" }, ...p]);
      try {
        const user = await ensureOracleSession();
        const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");

        // === DRAWING + PDF → server-side pdf-lib split + Gemini extraction ===
        if (docType === "drawing" && isPdf) {
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
            data: { projectId, packName: file.name, rawFilePath: rawPath },
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
                  detail:
                    res.extractionStatus === "complete"
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
    [docType, extraFields, onUploaded, projectId, register, registerPage],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
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
    <div className="glass-panel p-6">
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

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed ${borderColor} bg-black/20 p-6 text-center transition-colors`}
      >
        <div className="glass-accent flex h-12 w-12 items-center justify-center">
          <UploadCloud size={22} />
        </div>
        <div className="text-sm font-bold uppercase tracking-wider text-foreground">
          Drop files or click to browse
        </div>
        <div className="text-[0.7rem] uppercase tracking-widest text-foreground/50">
          PDF · Multi-file supported
        </div>
        <input
          type="file"
          multiple
          accept="application/pdf,image/*"
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
    </div>
  );
}
