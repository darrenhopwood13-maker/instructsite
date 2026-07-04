import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createDrawingDirectLinks, getDrawingPreview } from "@/lib/tier1-uploads.functions";

type Drawing = {
  id: string;
  drawing_no?: string | null;
  revision?: string | null;
  title?: string | null;
  level?: string | null;
  zone?: string | null;
  page_number?: number | null;
  pack_name?: string | null;
  extraction_status?: string;
  site_documents?: { file_name?: string; mime_type?: string } | null;
};

type DrawingLinks = { openPath: string; downloadPath: string; expiresAt: number };

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
  const directLinksFn = useServerFn(createDrawingDirectLinks);
  const links = useQuery<DrawingLinks>({
    queryKey: ["drawing-direct-links", selectedId],
    enabled: !!selectedId,
    staleTime: 60_000 * 8,
    queryFn: () => directLinksFn({ data: { drawingId: selectedId! } }),
  });

  const selected = drawings.find((d) => d.id === selectedId) ?? null;
  const label = selected
    ? `${selected.drawing_no ?? "DWG"} · ${selected.title ?? selected.site_documents?.file_name ?? ""}`
    : "";

  const absoluteUrl = (path?: string) => {
    if (!path) return "";
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).href;
  };
  const openUrl = absoluteUrl(links.data?.openPath);
  const downloadUrl = absoluteUrl(links.data?.downloadPath);

  return (
    <div className="glass-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          Active Project Drawings
        </h3>
        <span className="font-mono text-[0.7rem] text-foreground/60">{drawings.length}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* List */}
        <ul className="max-h-[44rem] space-y-1.5 overflow-y-auto pr-1">
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

        {/* Preview + metadata */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative flex min-h-[36rem] flex-col overflow-hidden rounded-lg border border-white/15 bg-black/60">
            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,120,0,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,120,0,0.15)_1px,transparent_1px)] [background-size:32px_32px]" />
            {!selectedId ? (
              <EmptyPreview />
            ) : (
              <InlinePreview
                key={selectedId}
                drawingId={selectedId}
                mimeHint={selected?.site_documents?.mime_type ?? undefined}
              />
            )}

            {selected && (
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
                <div className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-widest text-foreground/80">
                  {label}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={openUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!openUrl}
                    className="inline-flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    <ExternalLink size={10} /> Open
                  </a>
                  <a
                    href={downloadUrl || undefined}
                    download
                    aria-disabled={!downloadUrl}
                    className="inline-flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    <Download size={10} /> Download
                  </a>
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

          {selected && (
            <BlueprintMetadataCard
              drawing={selected}
              linksLoading={links.isLoading}
              linksError={links.isError}
              openUrl={openUrl}
              downloadUrl={downloadUrl}
            />
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

function InlinePreview({ openUrl, mime }: { openUrl: string; mime?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!openUrl) return;
    setStatus("loading");

    (async () => {
      try {
        const res = await fetch(openUrl, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");

        const effectiveType = blob.type || mime || "";
        if (effectiveType.startsWith("image/")) {
          const bmp = await createImageBitmap(blob);
          if (cancelled) return;
          const maxW = 1600;
          const scale = Math.min(1, maxW / bmp.width);
          canvas.width = Math.round(bmp.width * scale);
          canvas.height = Math.round(bmp.height * scale);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        } else if (effectiveType.includes("pdf")) {
          const pdfjs: any = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "";
          const buf = await blob.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        } else {
          throw new Error(`Unsupported type ${effectiveType}`);
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openUrl, mime]);

  return (
    <div className="relative z-10 m-auto flex w-full flex-1 items-center justify-center p-3">
      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
          <Loader2 size={16} className="animate-spin" /> Rendering drawing…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-20 m-auto flex flex-col items-center justify-center gap-2 text-center text-xs uppercase tracking-widest text-foreground/60">
          <FileText size={22} className="text-foreground/40" />
          Preview unavailable. Use Open or Download.
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-h-[34rem] w-auto max-w-full rounded-md bg-white shadow-[0_0_25px_rgba(255,120,0,0.15)]"
      />
    </div>
  );
}

function BlueprintMetadataCard({
  drawing,
  linksLoading,
  linksError,
  openUrl,
  downloadUrl,
}: {
  drawing: Drawing;
  linksLoading: boolean;
  linksError: boolean;
  openUrl: string;
  downloadUrl: string;
}) {
  const canLaunch = Boolean(openUrl) && !linksLoading;
  const canDownload = Boolean(downloadUrl) && !linksLoading;

  return (
    <div className="relative z-10 m-auto w-full max-w-2xl p-5">
      <div className="rounded-lg border border-alert/45 bg-gradient-to-br from-alert/20 via-black/80 to-black/95 p-5 shadow-[0_0_35px_rgba(255,120,0,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.35em] text-alert">
              Document Metadata Card
            </p>
            <h4 className="mt-2 font-mono text-2xl font-black uppercase tracking-widest text-foreground">
              {drawing.drawing_no || "Drawing Pending"}
            </h4>
          </div>
          <div className="rounded-md border border-alert/40 bg-alert px-3 py-2 text-right text-black">
            <p className="text-[0.55rem] font-black uppercase tracking-[0.25em]">Revision</p>
            <p className="font-mono text-xl font-black">{drawing.revision || "—"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <MetadataField
            label="Sheet Title"
            value={drawing.title || drawing.site_documents?.file_name || "Untitled sheet"}
            wide
          />
          <MetadataField label="Drawing Number" value={drawing.drawing_no || "Awaiting extraction"} />
          <MetadataField label="Revision Status" value={drawing.revision || "Not stated"} />
          <MetadataField
            label="Associated Work Zone"
            value={drawing.zone || drawing.level || "No zone linked"}
            icon={<MapPin size={14} />}
          />
          <MetadataField
            label="Sheet / Pack"
            value={`${drawing.page_number ? `Sheet ${drawing.page_number}` : "Single sheet"}${
              drawing.pack_name ? ` · ${drawing.pack_name}` : ""
            }`}
            icon={<Layers3 size={14} />}
          />
        </div>

        {linksError && (
          <div className="mt-4 rounded-md border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-foreground/80">
            Secure drawing launch link could not be prepared. Re-select the sheet and try again.
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canLaunch}
            onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}
            className="glass-orange flex min-h-16 items-center justify-center gap-2 rounded-md px-4 py-3 text-center text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linksLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            Launch Blueprint in Safe Window
          </button>
          <a
            href={canDownload ? downloadUrl : undefined}
            download
            aria-disabled={!canDownload}
            className="flex min-h-16 items-center justify-center gap-2 rounded-md border border-foreground/70 bg-foreground px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-background transition hover:bg-foreground/90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            {linksLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Force Download Document Sheet
          </a>
        </div>
      </div>
    </div>
  );
}

function MetadataField({
  label,
  value,
  icon,
  wide,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-md border border-white/10 bg-black/35 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="mb-1 flex items-center gap-1.5 text-alert">
        {icon ?? <FileText size={14} />}
        <p className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.28em]">{label}</p>
      </div>
      <p className="break-words text-sm font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}
