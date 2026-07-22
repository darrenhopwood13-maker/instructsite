import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Pencil,
  Share2,
  Download,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PdfViewer = lazy(() => import("@/components/tooling/PdfViewer"));

type Stroke = { points: { x: number; y: number }[]; color: string; width: number };

const COLORS = ["#FACC15", "#22C55E", "#EF4444", "#38BDF8", "#111827"];



export const Route = createFileRoute("/viewer")({
  head: () => ({
    meta: [
      { title: "Document Viewer · instructSite" },
      { name: "description", content: "Full-screen drawing and PDF viewer with mark-up tools." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentViewerRoute,
});

function DocumentViewerRoute() {
  const [kind, setKind] = useState<"image" | "pdf" | null>(null);
  const [name, setName] = useState("document");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const k = (sessionStorage.getItem("is-viewer-kind") ?? "image") as "image" | "pdf";
    const n = sessionStorage.getItem("is-viewer-name") ?? "document";
    setName(n);
    if (k === "pdf") {
      const b64 = sessionStorage.getItem("is-viewer-pdf");
      if (!b64) return void navigate({ to: "/tooling" });
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      setPdfBytes(bytes);
      setKind("pdf");
    } else {
      const src = sessionStorage.getItem("is-viewer-image");
      if (!src) return void navigate({ to: "/tooling" });
      setImgSrc(src);
      setKind("image");
    }
  }, [navigate]);

  if (kind === "pdf" && pdfBytes)
    return (
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading PDF viewer…</div>}>
        <PdfViewer bytes={pdfBytes} name={name} />
      </Suspense>
    );
  if (kind === "image" && imgSrc) return <ImageViewer src={imgSrc} name={name} />;
  return null;
}


function ImageViewer({ src, name }: { src: string; name: string }) {
  const navigate = useNavigate();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);

  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ d: number; scale: number } | null>(null);

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  };

  const setupCanvas = () => {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    redraw();
  };

  useEffect(redraw, [strokes]);

  const clientToImage = (clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((clientY - rect.top) / rect.height) * img.naturalHeight;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (drawing) {
      isDrawingRef.current = true;
      const p = clientToImage(e.clientX, e.clientY);
      setStrokes((s) => [...s, { points: [p], color, width: width * (1 / scale) * 2 }]);
    } else {
      isPanningRef.current = true;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDrawingRef.current) {
      const p = clientToImage(e.clientX, e.clientY);
      setStrokes((s) => {
        const next = s.slice();
        next[next.length - 1] = {
          ...next[next.length - 1],
          points: [...next[next.length - 1].points, p],
        };
        return next;
      });
    } else if (isPanningRef.current && lastPanRef.current) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      setTx((v) => v + dx);
      setTy((v) => v + dy);
    }
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
    isPanningRef.current = false;
    lastPanRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY * 0.0015;
    setScale((s) => Math.min(6, Math.max(0.4, s + delta * s)));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { d: Math.hypot(dx, dy), scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const ratio = d / pinchRef.current.d;
      setScale(Math.min(6, Math.max(0.4, pinchRef.current.scale * ratio)));
    }
  };
  const onTouchEnd = () => (pinchRef.current = null);

  const resetView = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const undo = () => setStrokes((s) => s.slice(0, -1));
  const clear = () => setStrokes([]);

  const compose = async (): Promise<Blob | null> => {
    const img = imgRef.current;
    if (!img) return null;
    const off = document.createElement("canvas");
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const ctx = off.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
    return new Promise((res) => off.toBlob((b) => res(b), "image/png"));
  };

  const download = async () => {
    const blob = await compose();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\.[^.]+$/, "")}-marked.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const blob = await compose();
    if (!blob) return;
    const file = new File([blob], `${name.replace(/\.[^.]+$/, "")}-marked.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "instructSite markup" });
      } catch {
        /* cancelled */
      }
    } else {
      await download();
      toast.success("Saved — share from your gallery");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-white/10 bg-white/[0.03] backdrop-blur px-3 py-2 flex items-center gap-2 z-20">
        <button
          onClick={() => navigate({ to: "/tooling" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-primary border border-primary/40 hover:bg-primary/10"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase truncate flex-1">
          ▸ Viewer · {name}
        </span>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-alert text-alert-foreground font-display hover:bg-alert/90"
        >
          <Share2 size={14} /> Share
        </button>
        <button onClick={download} title="Download" className="p-2 rounded-lg text-primary border border-primary/40 hover:bg-primary/10">
          <Download size={14} />
        </button>
      </header>

      <div
        className="flex-1 overflow-hidden relative touch-none select-none"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: drawing ? "crosshair" : "grab" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isPanningRef.current ? "none" : "transform 60ms linear",
          }}
        >
          <div className="relative">
            <img
              ref={imgRef}
              src={src}
              alt={name}
              onLoad={setupCanvas}
              draggable={false}
              className="max-h-[85vh] max-w-[95vw] object-contain pointer-events-none"
            />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-white/[0.03] backdrop-blur px-3 py-2 flex items-center gap-2 flex-wrap z-20">
        <button onClick={() => setScale((s) => Math.max(0.4, s - 0.25))} className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="font-mono text-[11px] text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(6, s + 0.25))} className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10" title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button onClick={resetView} className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10" title="Fit">
          <Maximize2 size={14} />
        </button>

        <span className="h-6 w-px bg-white/15 mx-1" />

        <button
          onClick={() => setDrawing((d) => !d)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
            drawing
              ? "bg-alert text-alert-foreground border-alert"
              : "text-alert border-alert/40 hover:bg-alert/10",
          )}
        >
          <Pencil size={14} /> {drawing ? "Drawing" : "Mark up"}
        </button>

        {drawing && (
          <>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-all",
                    color === c ? "border-white scale-110" : "border-white/30",
                  )}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <input
              type="range"
              min={2}
              max={16}
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value))}
              className="w-20 accent-alert"
            />
          </>
        )}

        <span className="h-6 w-px bg-white/15 mx-1" />

        <button onClick={undo} className="p-2 rounded-lg border border-white/15 text-muted-foreground hover:text-foreground hover:bg-white/5" title="Undo">
          <Undo2 size={14} />
        </button>
        <button onClick={clear} className="p-2 rounded-lg border border-white/15 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Clear">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
