import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  MapPin,
  Maximize2,
  Plus,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createDrawingDirectLinks,
  getDrawingPreview,
  setDrawingInDabs,
  allocateZonesForDabsDrawing,
} from "@/lib/tier1-uploads.functions";
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
  in_dabs?: boolean | null;
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
  permit_required?: boolean | null;
  permit_status?: string | null;
  high_risk_flags?: string[] | null;
  notes?: string | null;
  activity_id?: string | null;
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
  hideInternalSelector = false,
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
  hideInternalSelector?: boolean;
}) {

  const directLinksFn = useServerFn(createDrawingDirectLinks);
  const rolesFn = useServerFn(getMyRoles);
  const deleteFn = useServerFn(deleteDrawing);
  const setDabsFn = useServerFn(setDrawingInDabs);
  const allocateZonesFn = useServerFn(allocateZonesForDabsDrawing);
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    staleTime: 60_000,
  });
  const isMaster = roles.data?.roles?.includes("master_admin");
  const isAdmin =
    isMaster || roles.data?.roles?.includes("project_admin");
  const [togglingDabs, setTogglingDabs] = useState(false);
  const handleToggleDabs = async () => {
    if (!selected) return;
    setTogglingDabs(true);
    try {
      const next = !selected.in_dabs;
      await setDabsFn({ data: { drawingId: selected.id, inDabs: next } });
      if (next) {
        try {
          const res = await allocateZonesFn({ data: { drawingId: selected.id } });
          toast.success(
            `Added to DABS · Oracle mapped ${res?.allocated ?? 0} work zone${
              (res?.allocated ?? 0) === 1 ? "" : "s"
            }.`,
          );
        } catch (e: any) {
          toast.warning(
            `Added to DABS · Oracle zone allocation failed: ${e?.message ?? "unknown error"}`,
          );
        }
      } else {
        toast.success("Removed from DABS.");
      }
      qc.invalidateQueries({ queryKey: ["drawings"] });
      qc.invalidateQueries({ queryKey: ["dabs-drawings"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update DABS availability.");
    } finally {
      setTogglingDabs(false);
    }
  };



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
      {!hideInternalSelector && (
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
            {isAdmin && selected && (
              <button
                type="button"
                onClick={handleToggleDabs}
                disabled={togglingDabs}
                title={selected.in_dabs ? "Remove from DABS" : "Add this drawing to DABS pin-drop selector"}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[0.6rem] font-bold uppercase tracking-widest transition disabled:opacity-40 ${
                  selected.in_dabs
                    ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
                    : "border-alert bg-alert/15 text-alert hover:bg-alert/30"
                }`}
              >
                {togglingDabs ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : selected.in_dabs ? (
                  <Check size={12} />
                ) : (
                  <Plus size={12} />
                )}
                {selected.in_dabs ? "In DABS" : "Add to DABS"}
              </button>
            )}
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
      )}

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
          <div className="relative z-10 grid gap-2 border-t border-white/10 bg-black/70 px-3 py-2 backdrop-blur sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div
              className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-widest text-foreground/80"
              title={label}
            >
              {label}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={openUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!openUrl}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-white/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <ExternalLink size={10} /> Open
              </a>
              <a
                href={downloadUrl || undefined}
                download
                aria-disabled={!downloadUrl}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-white/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <Download size={10} /> Download
              </a>
              <button
                type="button"
                onClick={() => onLockOracle({ kind: "drawing", id: selected.id, label })}
                className="glass-orange inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-[0.6rem] uppercase tracking-widest"
              >
                <Sparkles size={10} /> Lock to Oracle
              </button>
              <Link
                to="/oracle"
                search={{ drawingId: selected.id, label } as never}
                onClick={() => onLockOracle({ kind: "drawing", id: selected.id, label })}
                className="glass-btn inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-[0.6rem] uppercase tracking-widest"
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const pdfDocRef = useRef<any>(null);
  const imageBitmapRef = useRef<ImageBitmap | null>(null);
  const objectUrlRef = useRef<string>("");
  const renderTaskRef = useRef<any>(null);
  const rerenderTimerRef = useRef<any>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [mime, setMime] = useState<string>(mimeHint ?? "");
  const [pageNum, setPageNum] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Intrinsic sheet dimensions (PDF/image points) — set once when doc/page loads
  const [sheetSize, setSheetSize] = useState<{ w: number; h: number } | null>(null);
  // renderedQuality = multiplier used the last time we rasterized. We re-rasterize
  // when the user zooms beyond this so text stays crisp.
  const [renderedQuality, setRenderedQuality] = useState<number>(2);

  // User zoom (1 = fit-to-window). Pan offset in CSS px relative to viewport.
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Track container size
  useEffect(() => {
    const el = viewportRef.current;
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

  const [signedUrl, setSignedUrl] = useState<string>("");

  // Fetch + decode
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrMsg("");
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setPageNum(1);
    setTotalPages(1);
    setSheetSize(null);
    setRenderedQuality(3);
    setSignedUrl("");

    (async () => {
      try {
        const meta = await getPreviewFn({ data: { drawingId } });
        if (cancelled) return;
        if (meta.signedUrl) setSignedUrl(meta.signedUrl);

        // Prefer signed URL fetch (works across CORS + no session dependency);
        // fall back to storage.download when signed URL is unavailable.
        let blob: Blob | null = null;
        if (meta.signedUrl) {
          try {
            const res = await fetch(meta.signedUrl, {
              mode: "cors",
              credentials: "omit",
              cache: "no-store",
            });
            if (res.ok) blob = await res.blob();
          } catch {
            /* fall through to storage download */
          }
        }
        if (!blob) {
          const { data, error } = await supabase.storage
            .from(meta.bucket)
            .download(meta.path);
          if (error || !data) throw new Error(error?.message ?? "Download failed");
          blob = data;
        }
        if (cancelled) return;

        const effectiveMime = blob.type || meta.mimeType || mimeHint || "";
        setMime(effectiveMime);
        const buf = await blob.arrayBuffer();
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
          const bmp = await createImageBitmap(blob);
          if (cancelled) {
            bmp.close?.();
            return;
          }
          imageBitmapRef.current = bmp;
          objectUrlRef.current = URL.createObjectURL(blob);
        } else {
          objectUrlRef.current = URL.createObjectURL(blob);
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
      if (rerenderTimerRef.current) clearTimeout(rerenderTimerRef.current);
    };
  }, [drawingId, getPreviewFn, mimeHint]);

  // Compute fit scale — sheet drawn at this CSS size fits the viewport with padding
  const { w: cw, h: ch } = containerSize;
  const availW = Math.max(100, cw - 16);
  const availH = Math.max(100, ch - 16);
  const fitScale = sheetSize
    ? Math.min(availW / sheetSize.w, availH / sheetSize.h)
    : 1;
  const fittedW = sheetSize ? sheetSize.w * fitScale : 0;
  const fittedH = sheetSize ? sheetSize.h * fitScale : 0;

  // Render (rasterize) — runs when doc changes, page changes, viewport size changes, or quality bumps
  useEffect(() => {
    if (status !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (cw < 20 || ch < 20) return;

    let cancelled = false;

    (async () => {
      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const MAX_PIXELS = 80_000_000; // ~80 MP cap for crisper text on large sheets

        if (pdfDocRef.current) {
          const page = await pdfDocRef.current.getPage(pageNum);
          if (cancelled) return;
          const baseVp = page.getViewport({ scale: 1 });
          const baseFit = Math.min(availW / baseVp.width, availH / baseVp.height);

          let renderScale = baseFit * renderedQuality * dpr;
          const projectedPixels = baseVp.width * renderScale * baseVp.height * renderScale;
          if (projectedPixels > MAX_PIXELS) {
            renderScale *= Math.sqrt(MAX_PIXELS / projectedPixels);
          }

          const viewport = page.getViewport({ scale: renderScale });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const cssW = baseVp.width * baseFit;
          const cssH = baseVp.height * baseFit;
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
          if (!sheetSize || sheetSize.w !== baseVp.width || sheetSize.h !== baseVp.height) {
            setSheetSize({ w: baseVp.width, h: baseVp.height });
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          try {
            renderTaskRef.current?.cancel?.();
          } catch {}
          renderTaskRef.current = page.render({ canvasContext: ctx, viewport, canvas });
          await renderTaskRef.current.promise;
        } else if (imageBitmapRef.current) {
          const bmp = imageBitmapRef.current;
          const baseFit = Math.min(availW / bmp.width, availH / bmp.height);
          let renderScale = baseFit * renderedQuality * dpr;
          const projectedPixels = bmp.width * renderScale * bmp.height * renderScale;
          if (projectedPixels > MAX_PIXELS) {
            renderScale *= Math.sqrt(MAX_PIXELS / projectedPixels);
          }
          canvas.width = Math.max(1, Math.round(bmp.width * renderScale));
          canvas.height = Math.max(1, Math.round(bmp.height * renderScale));
          const cssW = bmp.width * baseFit;
          const cssH = bmp.height * baseFit;
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
          if (!sheetSize || sheetSize.w !== bmp.width || sheetSize.h !== bmp.height) {
            setSheetSize({ w: bmp.width, h: bmp.height });
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pageNum, renderedQuality, cw, ch]);

  // When user zooms far beyond current rasterization, re-render at higher quality
  useEffect(() => {
    if (status !== "ready") return;
    if (rerenderTimerRef.current) clearTimeout(rerenderTimerRef.current);
    const targetQuality = Math.max(3, Math.ceil(zoom * 2));
    if (targetQuality > renderedQuality) {
      rerenderTimerRef.current = setTimeout(() => {
        setRenderedQuality(Math.min(targetQuality, 10));
      }, 250);
    }
    return () => {
      if (rerenderTimerRef.current) clearTimeout(rerenderTimerRef.current);
    };
  }, [zoom, status, renderedQuality]);

  // Anchored zoom helper — keep point (px,py) in viewport coords fixed under new zoom
  const zoomAt = (nextZoom: number, px: number, py: number) => {
    setZoom((prev) => {
      const z = Math.max(0.1, Math.min(nextZoom, 12));
      const ratio = z / prev;
      setOffset((o) => ({
        x: px - (px - o.x) * ratio,
        y: py - (py - o.y) * ratio,
      }));
      return z;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinMode === "drop") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const s = dragStartRef.current;
    setOffset({ x: s.ox + (e.clientX - s.x), y: s.oy + (e.clientY - s.y) });
  };
  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) {
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
    setDragging(false);
    dragStartRef.current = null;
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoomIn = () => {
    if (!viewportRef.current) return;
    const r = viewportRef.current.getBoundingClientRect();
    zoomAt(zoom * 1.25, r.width / 2, r.height / 2);
  };
  const zoomOut = () => {
    if (!viewportRef.current) return;
    const r = viewportRef.current.getBoundingClientRect();
    zoomAt(zoom / 1.25, r.width / 2, r.height / 2);
  };

  // Native wheel listener with passive:false so preventDefault works
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!sheetSize) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // Pinch-zoom on trackpads reports ctrlKey=true. Otherwise two-finger
      // scroll should pan, not zoom.
      const isPinch = e.ctrlKey || e.metaKey;
      if (isPinch) {
        // Smaller factor scaled by deltaY magnitude for smooth pinch
        const intensity = Math.min(Math.abs(e.deltaY), 40) / 100;
        const factor = e.deltaY < 0 ? 1 + intensity : 1 / (1 + intensity);
        setZoom((prev) => {
          const z = Math.max(0.1, Math.min(prev * factor, 12));
          const ratio = z / prev;
          setOffset((o) => ({
            x: px - (px - o.x) * ratio,
            y: py - (py - o.y) * ratio,
          }));
          return z;
        });
      } else {
        // Two-finger pan
        setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sheetSize]);

  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");
  const isCanvasable = isPdf || isImage;

  const cursorClass =
    pinMode === "drop"
      ? "cursor-crosshair"
      : dragging
        ? "cursor-grabbing"
        : "cursor-grab";

  return (
    <div className="relative z-10 flex w-full flex-1 flex-col p-3">
      {status === "loading" && (
        <div className="m-auto flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
          <Loader2 size={16} className="animate-spin" /> Streaming drawing…
        </div>
      )}
      {status === "error" && (
        <div className="m-auto flex flex-col items-center justify-center gap-3 p-4 text-center">
          {signedUrl ? (
            <div className="w-full max-w-4xl overflow-hidden rounded-md border-2 border-white/15 bg-white shadow-2xl">
              <iframe
                src={signedUrl}
                title="Drawing preview"
                className="h-[70vh] w-full"
              />
            </div>
          ) : (
            <>
              <FileText size={22} className="text-foreground/40" />
              <p className="text-xs uppercase tracking-widest text-foreground/60">
                Preview unavailable{errMsg ? `: ${errMsg}` : ""}.
              </p>
            </>
          )}
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-widest text-foreground/80 hover:border-alert hover:text-alert"
            >
              <ExternalLink size={12} /> Open PDF in new tab
            </a>
          )}
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
                onClick={resetView}
                className="ml-1 inline-flex h-7 items-center justify-center gap-1 rounded-sm px-2 text-[0.6rem] uppercase tracking-widest text-foreground/80 hover:bg-white/10"
                title="Fit to window"
              >
                <Maximize2 size={12} /> Fit
              </button>
            </div>

            <div className="hidden font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50 md:block">
              Pinch or Ctrl+scroll to zoom · Two-finger scroll or drag to pan · Double-click to fit
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
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={resetView}
            className={`relative flex-1 overflow-hidden rounded-md bg-black/40 select-none ${cursorClass}`}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: sheetSize ? fittedW : "auto",
                height: sheetSize ? fittedH : "auto",
                transform: sheetSize
                  ? `translate(${(cw - fittedW) / 2 + offset.x}px, ${(ch - fittedH) / 2 + offset.y}px) scale(${zoom})`
                  : "translate(0,0)",
                transformOrigin: "0 0",
                visibility: sheetSize ? "visible" : "hidden",
              }}
            >
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
                className="block rounded-sm bg-white shadow-[0_0_25px_rgba(255,120,0,0.15)]"
              />
              <PinOverlay
                pins={pins}
                activePinId={activePinId}
                onPinClick={onPinClick}
                inverseScale={1 / zoom}
              />
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

function PinOverlay({
  pins,
  activePinId,
  onPinClick,
  inverseScale,
}: {
  pins?: PinRecord[];
  activePinId?: string | null;
  onPinClick?: (pin: PinRecord) => void;
  inverseScale?: number;
}) {
  if (!pins || pins.length === 0) return null;
  const now = Date.now();
  const inv = inverseScale ?? 1;
  return (
    <div className="pointer-events-none absolute inset-0">
      {pins.map((pin) => {
        const overtime =
          pin.scheduled_finish && new Date(pin.scheduled_finish).getTime() < now;
        const isActive = activePinId === pin.id;
        const needsPermit =
          !!pin.permit_required && pin.permit_status !== "active";
        return (
          <button
            key={pin.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPinClick?.(pin);
            }}
            style={{
              left: `${pin.x_pct * 100}%`,
              top: `${pin.y_pct * 100}%`,
              transform: `translate(-50%, -50%) scale(${inv})`,
              transformOrigin: "center",
            }}
            className="pointer-events-auto absolute"
            title={
              needsPermit
                ? `PERMIT REQUIRED · ${pin.trade_package ?? "Pin"}`
                : (pin.trade_package ?? "Pin")
            }
          >
            {needsPermit ? (
              <span className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-sm border-2 border-black bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.9)]">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                    <path d="M12 2 1 21h22L12 2Zm0 6 7.53 12H4.47L12 8Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
                  </svg>
                </span>
                <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-amber-400 px-1.5 py-[1px] font-mono text-[0.5rem] font-bold uppercase tracking-widest text-black shadow">
                  Permit
                </span>
              </span>
            ) : (
              <span
                className={`relative flex h-4 w-4 items-center justify-center ${isActive ? "scale-125" : ""} transition-transform`}
              >
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    overtime ? "bg-red-500" : "bg-orange-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full border-2 border-white shadow-lg ${
                    overtime ? "bg-red-600" : "bg-orange-500"
                  }`}
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
