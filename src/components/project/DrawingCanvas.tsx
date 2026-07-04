import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileText, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Drawing = {
  id: string;
  drawing_no?: string | null;
  revision?: string | null;
  title?: string | null;
  level?: string | null;
  page_number?: number | null;
  pack_name?: string | null;
  extraction_status?: string;
  site_documents?: { file_name?: string; mime_type?: string } | null;
};

type PreviewBlob = {
  dataUrl: string;
  mime: string;
  fileName: string;
  blob: Blob;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchDrawingBlob(
  drawingId: string,
  opts: { download?: boolean } = {},
): Promise<{ blob: Blob; mime: string; fileName: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const url = `/api/drawing/${drawingId}${opts.download ? "?download=1" : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "same-origin",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Preview failed (${res.status})`);
  }
  const disp = res.headers.get("content-disposition") ?? "";
  const match = disp.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? "drawing";
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const blob = await res.blob();
  return { blob, mime, fileName };
}

export function DrawingCanvas({
  drawings,
  selectedId,
  onSelect,
  onLockOracle,
}: {
  drawings: Drawing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLockOracle: (payload: { kind: "drawing"; id: string; label: string }) => void;
}) {
  const preview = useQuery<PreviewBlob>({
    queryKey: ["drawing-blob", selectedId],
    enabled: !!selectedId,
    staleTime: 60_000 * 20,
    queryFn: async () => {
      const { blob, mime, fileName } = await fetchDrawingBlob(selectedId!);
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, mime, fileName, blob };
    },
  });

  const selected = drawings.find((d) => d.id === selectedId) ?? null;
  const label = selected
    ? `${selected.drawing_no ?? "DWG"} · ${selected.title ?? selected.site_documents?.file_name ?? ""}`
    : "";

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const { blob, fileName } = await fetchDrawingBlob(selected.id, { download: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="glass-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          Active Project Drawings
        </h3>
        <span className="font-mono text-[0.7rem] text-foreground/60">{drawings.length}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1.4fr]">
        {/* List */}
        <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
          {drawings.map((d) => {
            const active = d.id === selectedId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect(d.id)}
                  className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                    active
                      ? "border-alert bg-alert/15 shadow-[0_0_18px_rgba(255,120,0,0.25)]"
                      : "border-white/10 bg-black/25 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-widest text-foreground/80">
                    <FileText size={12} className={active ? "text-alert" : "text-foreground/50"} />
                    {d.page_number != null && (
                      <span className="rounded-sm bg-alert/25 px-1 py-px text-[0.55rem] font-bold text-alert">
                        Sheet {d.page_number}
                      </span>
                    )}
                    <span className="truncate">{d.drawing_no ?? "—"}</span>
                    {d.revision && (
                      <span className="rounded-sm border border-white/15 px-1 py-px text-[0.55rem] text-foreground/70">
                        rev {d.revision}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[0.72rem] text-foreground/70">
                    {d.title ?? d.site_documents?.file_name ?? "Untitled"}
                  </p>
                  {d.pack_name && (
                    <p className="mt-0.5 truncate font-mono text-[0.55rem] uppercase tracking-widest text-foreground/40">
                      Pack: {d.pack_name}
                    </p>
                  )}
                  {d.level && (
                    <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                      Level {d.level}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
          {drawings.length === 0 && (
            <li className="rounded-md border border-white/10 bg-black/20 p-4 text-center text-xs text-foreground/50">
              No drawings uploaded yet.
            </li>
          )}
        </ul>

        {/* Preview canvas */}
        <div className="relative flex min-h-[24rem] flex-col overflow-hidden rounded-lg border border-white/15 bg-black/60">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,120,0,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,120,0,0.15)_1px,transparent_1px)] [background-size:32px_32px]" />
          {!selectedId ? (
            <EmptyPreview />
          ) : preview.isLoading ? (
            <div className="relative m-auto flex flex-col items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
              <Loader2 size={18} className="animate-spin text-alert" />
              Loading drawing…
            </div>
          ) : preview.isError ? (
            <BlockedFallback onDownload={handleDownload} downloading={downloading} />
          ) : preview.data ? (
            <PreviewFrame url={preview.data.objectUrl} mime={preview.data.mime} />
          ) : null}

          {selected && (
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
              <div className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-widest text-foreground/80">
                {label}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40 disabled:opacity-50"
                >
                  {downloading ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onLockOracle({ kind: "drawing", id: selected.id, label })}
                  className="glass-orange inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[0.6rem] uppercase tracking-widest"
                >
                  <Sparkles size={10} /> Lock to Oracle
                </button>
                <Link
                  to="/oracle"
                  search={{ drawingId: selected.id, label } as never}
                  onClick={() => onLockOracle({ kind: "drawing", id: selected.id, label })}
                  className="glass-btn inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[0.6rem] uppercase tracking-widest"
                >
                  Ask Oracle
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="relative m-auto flex flex-col items-center gap-2 text-center text-xs uppercase tracking-widest text-foreground/50">
      <FileText size={22} className="text-foreground/40" />
      <span>Select a drawing to preview</span>
    </div>
  );
}

function PreviewFrame({ url, mime }: { url: string; mime: string }) {
  const isImage = /^image\//i.test(mime);
  const isPdf = /pdf/i.test(mime);
  if (isImage) {
    return (
      <img
        src={url}
        alt="Drawing preview"
        className="relative m-auto max-h-[26rem] max-w-full object-contain"
      />
    );
  }
  if (isPdf) {
    return (
      <iframe
        src={`${url}#toolbar=0&view=FitH`}
        title="Drawing preview"
        className="relative h-[28rem] w-full border-0 bg-white"
      />
    );
  }
  return (
    <div className="relative m-auto p-4 text-center text-xs text-foreground/60">
      Unsupported file type. Use Download to open it locally.
    </div>
  );
}

function BlockedFallback({
  onDownload,
  downloading,
}: {
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div className="relative m-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-alert/40 bg-alert/10 p-5 text-center">
      <ShieldAlert size={22} className="text-alert" />
      <p className="text-xs leading-relaxed text-foreground/85">
        Browser security is restricting the preview wrapper. Click below to download and view the
        drawing directly.
      </p>
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        className="glass-orange inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[0.65rem] uppercase tracking-widest disabled:opacity-50"
      >
        {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
        Download drawing
      </button>
    </div>
  );
}
