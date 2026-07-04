import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  MapPin,
  Maximize2,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createDrawingDirectLinks, getDrawingPreview } from "@/lib/tier1-uploads.functions";
import { deleteDrawing } from "@/lib/admin.functions";
import { getMyRoles } from "@/lib/projects.functions";

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

export type PinRecord = {
  id: string;
  x_pct: number;
  y_pct: number;
  status?: string | null;
  subcontractor_id?: string | null;
  trade_package?: string | null;
  operative_count?: number | null;
  start_time?: string | null;
  scheduled_finish?: string | null;
  work_zones?: { name?: string | null; level?: string | null } | null;
};

export function DrawingCanvas({
  drawings,
  selectedId,
  onSelect,
  onLockOracle,
  pins,
  pinMode = "none",
  onDropPin,
  onPinClick,
  activePinId,
}: {
  drawings: Drawing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLockOracle: (payload: { kind: "drawing"; id: string; label: string }) => void;
  pins?: PinRecord[];
  pinMode?: "drop" | "view" | "none";
  onDropPin?: (coords: { xPct: number; yPct: number }) => void;
  onPinClick?: (pin: PinRecord) => void;
  activePinId?: string | null;
}) {

  const directLinksFn = useServerFn(createDrawingDirectLinks);
  const rolesFn = useServerFn(getMyRoles);
  const deleteFn = useServerFn(deleteDrawing);
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    staleTime: 60_000,
  });
  const isMaster = roles.data?.roles?.includes("master_admin");

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

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!selected) return;
    const ok = window.confirm(
      `Permanently delete ${selected.drawing_no ?? "this drawing"}? This purges the sheet from the drawing vault and DABS selectors.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { drawingId: selected.id } });
      toast.success("Drawing deleted.");
      onSelect("");
      qc.invalidateQueries({ queryKey: ["drawings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          Active Project Drawings
        </h3>
        <span className="font-mono text-[0.7rem] text-foreground/60">{drawings.length}</span>
      </div>

      {/* Elegant single-select dropdown for sheets */}
      <div className="mb-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Select Sheet
          </span>
          <div className="flex items-center gap-2">
            <select
              value={selectedId ?? ""}
              onChange={(e) => onSelect(e.target.value)}
              className="flex-1 rounded-md border border-white/15 bg-black/50 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
            >
              <option value="" disabled>
                {drawings.length ? "— Choose a drawing —" : "No drawings uploaded"}
              </option>
              {drawings.map((d) => {
                const title = d.title ?? d.site_documents?.file_name ?? "Untitled";
                const rev = d.revision ? ` · Rev ${d.revision}` : "";
                const sheet = d.page_number ? ` · Sheet ${d.page_number}` : "";
                return (
                  <option key={d.id} value={d.id}>
                    {(d.drawing_no ?? "DWG")}{rev}{sheet} — {title}
                  </option>
                );
              })}
            </select>
            {isMaster && selected && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                title="Delete drawing (Master Admin)"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-alert bg-alert/15 text-alert transition hover:bg-alert/30 disabled:opacity-40"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            )}
          </div>
        </label>

      </div>

      {/* Compact metadata strip */}
      {selected && (
        <CompactMetadataStrip drawing={selected} />
      )}

      {/* Preview */}
      <div className="relative mt-3 flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-lg border border-white/15 bg-black/60">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,120,0,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,120,0,0.15)_1px,transparent_1px)] [background-size:32px_32px]" />
        {!selectedId ? (
          <EmptyPreview />
        ) : (
          <InlinePreview
            key={selectedId}
            drawingId={selectedId}
            mimeHint={selected?.site_documents?.mime_type ?? undefined}
            pins={pins}
            pinMode={pinMode}
            onDropPin={onDropPin}
            onPinClick={onPinClick}
            activePinId={activePinId ?? null}
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

function CompactMetadataStrip({ drawing }: { drawing: Drawing }) {
  const items: Array<{ label: string; value: string; icon?: ReactNode }> = [
    {
      label: "Title",
      value: drawing.title || drawing.site_documents?.file_name || "Untitled",
      icon: <FileText size={11} />,
    },
    { label: "Rev", value: drawing.revision || "—" },
    {
      label: "Zone",
      value: drawing.zone || drawing.level || "—",
      icon: <MapPin size={11} />,
    },
    {
      label: "Sheet",
      value: `${drawing.page_number ? `#${drawing.page_number}` : "1"}${drawing.pack_name ? ` · ${drawing.pack_name}` : ""}`,
      icon: <Layers3 size={11} />,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-alert/40 bg-gradient-to-r from-alert/10 via-black/60 to-black/70 p-2.5 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <div className="flex items-center gap-1 text-alert">
            {it.icon ?? <FileText size={11} />}
            <p className="font-mono text-[0.5rem] font-bold uppercase tracking-[0.25em]">{it.label}</p>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-foreground" title={it.value}>
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function InlinePreview({
  drawingId,
  mimeHint,
  pins = [],
  pinMode = "none",
  onDropPin,
  onPinClick,
  activePinId,
}: {
  drawingId: string;
  mimeHint?: string;
  pins?: PinRecord[];
  pinMode?: "drop" | "view" | "none";
  onDropPin?: (coords: { xPct: number; yPct: number }) => void;
  onPinClick?: (pin: PinRecord) => void;
  activePinId?: string | null;
}) {

  const getPreviewFn = useServerFn(getDrawingPreview);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const pdfDocRef = useRef<any>(null);
  const imageBitmapRef = useRef<ImageBitmap | null>(null);
  const objectUrlRef = useRef<string>("");
  const renderTaskRef = useRef<any>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [mime, setMime] = useState<string>(mimeHint ?? "");
  const [zoom, setZoom] = useState<number>(1);
  const [pageNum, setPageNum] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Track container size for auto-fit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setContainerSize({ w: rect.width, h: rect.height });
    return () => ro.disconnect();
  }, [status]);

  // Fetch + decode
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrMsg("");
    setZoom(1);
    setPageNum(1);
    setTotalPages(1);

    (async () => {
      try {
        const meta = await getPreviewFn({ data: { drawingId } });
        if (cancelled) return;
        const { data, error } = await supabase.storage
          .from(meta.bucket)
          .download(meta.path);
        if (error || !data) throw new Error(error?.message ?? "Download failed");
        if (cancelled) return;

        const effectiveMime = data.type || meta.mimeType || mimeHint || "";
        setMime(effectiveMime);
        const buf = await data.arrayBuffer();
        if (cancelled) return;
        bufferRef.current = buf;

        if (effectiveMime.includes("pdf")) {
          const pdfjs: any = await import("pdfjs-dist");
          const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
          if (cancelled) {
            doc.destroy();
            return;
          }
          pdfDocRef.current = doc;
          setTotalPages(doc.numPages);
        } else if (effectiveMime.startsWith("image/")) {
          const bmp = await createImageBitmap(data);
          if (cancelled) {
            bmp.close?.();
            return;
          }
          imageBitmapRef.current = bmp;
          objectUrlRef.current = URL.createObjectURL(data);
        } else {
          objectUrlRef.current = URL.createObjectURL(data);
        }

        if (!cancelled) setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setErrMsg(e?.message ?? "Preview failed");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel?.();
      } catch {}
      pdfDocRef.current?.destroy?.();
      pdfDocRef.current = null;
      imageBitmapRef.current?.close?.();
      imageBitmapRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
      bufferRef.current = null;
    };
  }, [drawingId, getPreviewFn, mimeHint]);

  // Render — auto-fit sheet to container, then apply zoom multiplier
  useEffect(() => {
    if (status !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w: cw, h: ch } = containerSize;
    if (cw < 20 || ch < 20) return;

    let cancelled = false;

    (async () => {
      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Reserve a little padding
        const availW = Math.max(100, cw - 16);
        const availH = Math.max(100, ch - 16);

        if (pdfDocRef.current) {
          const page = await pdfDocRef.current.getPage(pageNum);
          if (cancelled) return;
          const baseVp = page.getViewport({ scale: 1 });
          const fitScale = Math.min(availW / baseVp.width, availH / baseVp.height);
          const viewport = page.getViewport({ scale: fitScale * zoom * dpr });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          try {
            renderTaskRef.current?.cancel?.();
          } catch {}
          renderTaskRef.current = page.render({ canvasContext: ctx, viewport, canvas });
          await renderTaskRef.current.promise;
        } else if (imageBitmapRef.current) {
          const bmp = imageBitmapRef.current;
          const fitScale = Math.min(availW / bmp.width, availH / bmp.height);
          const scale = fitScale * zoom * dpr;
          canvas.width = Math.max(1, Math.round(bmp.width * scale));
          canvas.height = Math.max(1, Math.round(bmp.height * scale));
          canvas.style.width = `${Math.round(bmp.width * scale / dpr)}px`;
          canvas.style.height = `${Math.round(bmp.height * scale / dpr)}px`;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        }
      } catch (e: any) {
        if (!cancelled && e?.name !== "RenderingCancelledException") {
          setErrMsg(e?.message ?? "Render failed");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, zoom, pageNum, containerSize]);

  const zoomIn = () => setZoom((z) => Math.min(z * 1.25, 6));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.25, 0.25));
  const resetZoom = () => setZoom(1);

  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");
  const isCanvasable = isPdf || isImage;

  return (
    <div className="relative z-10 flex w-full flex-1 flex-col p-3">
      {status === "loading" && (
        <div className="m-auto flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
          <Loader2 size={16} className="animate-spin" /> Streaming drawing…
        </div>
      )}
      {status === "error" && (
        <div className="m-auto flex flex-col items-center justify-center gap-2 text-center text-xs uppercase tracking-widest text-foreground/60">
          <FileText size={22} className="text-foreground/40" />
          Preview unavailable{errMsg ? `: ${errMsg}` : ""}.
        </div>
      )}

      {status === "ready" && isCanvasable && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-md border border-white/15 bg-black/60 p-1">
              <button
                type="button"
                onClick={zoomOut}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground/80 hover:bg-white/10"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="min-w-[3rem] text-center font-mono text-[0.65rem] uppercase tracking-widest text-foreground/70">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={zoomIn}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground/80 hover:bg-white/10"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                className="ml-1 inline-flex h-7 items-center justify-center gap-1 rounded-sm px-2 text-[0.6rem] uppercase tracking-widest text-foreground/80 hover:bg-white/10"
                title="Fit to window"
              >
                <Maximize2 size={12} /> Fit
              </button>
            </div>

            {isPdf && totalPages > 1 && (
              <div className="flex items-center gap-1 rounded-md border border-white/15 bg-black/60 p-1 text-[0.65rem] font-mono uppercase tracking-widest text-foreground/70">
                <button
                  type="button"
                  onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                  disabled={pageNum <= 1}
                  className="rounded-sm px-2 py-1 hover:bg-white/10 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2">
                  {pageNum} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                  disabled={pageNum >= totalPages}
                  className="rounded-sm px-2 py-1 hover:bg-white/10 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div
            ref={containerRef}
            className="flex-1 touch-pan-x touch-pan-y overflow-auto rounded-md bg-black/40"
          >
            <div className="flex min-h-full items-center justify-center p-2">
              <div className="relative inline-block">
                <canvas
                  ref={canvasRef}
                  onClick={(e) => {
                    if (pinMode !== "drop" || !onDropPin) return;
                    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const xPct = (e.clientX - rect.left) / rect.width;
                    const yPct = (e.clientY - rect.top) / rect.height;
                    if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return;
                    onDropPin({ xPct, yPct });
                  }}
                  className={`rounded-sm bg-white shadow-[0_0_25px_rgba(255,120,0,0.15)] ${pinMode === "drop" ? "cursor-crosshair" : ""}`}
                />
                <PinOverlay
                  pins={pins}
                  activePinId={activePinId}
                  onPinClick={onPinClick}
                />
              </div>
            </div>

          </div>
        </>
      )}

      {status === "ready" && !isCanvasable && objectUrlRef.current && (
        <div className="m-auto flex flex-col items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
          <FileText size={22} className="text-foreground/40" />
          <a
            href={objectUrlRef.current}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open file
          </a>
        </div>
      )}
    </div>
  );
}
