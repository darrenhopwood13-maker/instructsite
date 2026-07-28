import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type GuideAction =
  | "reveal"
  | "move"
  | "click"
  | "type"
  | "highlight"
  | "toast"
  | "wait";

export interface GuideHotspot {
  /** All values are percentages of the framed screenshot (0-100). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GuideStep {
  caption: string;
  narration?: string;
  action: GuideAction;
  hotspot: GuideHotspot;
  text?: string;
  ms?: number;
}

export interface GuideDemoProps {
  title?: string;
  steps: GuideStep[];
  /** Full-resolution screenshot URL (CDN or import). */
  shot: string;
  shotAlt: string;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MS: Record<GuideAction, number> = {
  reveal: 700,
  move: 900,
  click: 550,
  type: 1400,
  highlight: 1200,
  toast: 1600,
  wait: 800,
};

const LOOP_PAUSE_MS = 1500;
const ZOOM_COVERAGE = 0.7; // hotspot fills ~70% of frame

/* -------------------------------------------------------------------------- */
/*  Module-level singleton registry: only one player animates at a time.       */
/* -------------------------------------------------------------------------- */

type Pauser = () => void;
const registry = new Set<{ id: symbol; pause: Pauser; visible: boolean }>();
let active: symbol | null = null;

function claim(id: symbol) {
  if (active === id) return;
  for (const entry of registry) {
    if (entry.id !== id) entry.pause();
  }
  active = id;
}
function release(id: symbol) {
  if (active === id) active = null;
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export const GuideDemo = ({ title, steps, shot, shotAlt, className }: GuideDemoProps) => {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol>(Symbol("guide-demo"));

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [typedChars, setTypedChars] = useState(0);
  const [clickPulse, setClickPulse] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);

  const total = steps.length;
  const step = steps[stepIdx];

  /* ------ visibility gating (viewport + tab) ------ */
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const on = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  /* ------ registry: pause other players when this one starts ------ */
  useEffect(() => {
    const id = idRef.current;
    const entry = { id, pause: () => setPlaying(false), visible: false };
    registry.add(entry);
    return () => {
      registry.delete(entry);
      release(id);
    };
  }, []);

  /* ------ autoplay when eligible ------ */
  useEffect(() => {
    if (reduced) {
      setPlaying(false);
      return;
    }
    const eligible = inView && tabVisible;
    if (eligible) {
      claim(idRef.current);
      setPlaying(true);
    } else {
      if (active === idRef.current) release(idRef.current);
      setPlaying(false);
    }
  }, [inView, tabVisible, reduced]);

  /* ------ single RAF loop per player ------ */
  const stepStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef<number>(0);

  const resetTransient = useCallback(() => {
    setTypedChars(0);
    setToast(null);
    setClickPulse(0);
    pausedElapsedRef.current = 0;
  }, []);

  useEffect(() => {
    // when step changes, reset per-step transients & fire click ripple
    resetTransient();
    if (step?.action === "click") setClickPulse((n) => n + 1);
    if (step?.action === "toast") setToast(step.text ?? step.caption);
    stepStartRef.current = 0;
  }, [stepIdx, step, resetTransient]);

  useEffect(() => {
    if (!playing || !step || reduced) return;

    const duration = (step.ms ?? DEFAULT_MS[step.action]) / speed;
    let cancelled = false;

    const loop = (t: number) => {
      if (cancelled) return;
      if (stepStartRef.current === 0) stepStartRef.current = t - pausedElapsedRef.current;
      const elapsed = t - stepStartRef.current;
      const frac = Math.min(1, elapsed / duration);

      if (step.action === "type" && step.text) {
        const n = Math.floor(step.text.length * frac);
        setTypedChars((prev) => (prev === n ? prev : n));
      }

      if (frac >= 1) {
        // advance step
        pausedElapsedRef.current = 0;
        stepStartRef.current = 0;
        const next = stepIdx + 1;
        if (next >= total) {
          // loop with pause
          const pauseStart = t;
          const waitLoop = (tt: number) => {
            if (cancelled) return;
            if (tt - pauseStart >= LOOP_PAUSE_MS / speed) {
              setStepIdx(0);
              return;
            }
            rafRef.current = requestAnimationFrame(waitLoop);
          };
          rafRef.current = requestAnimationFrame(waitLoop);
        } else {
          setStepIdx(next);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, stepIdx, speed, reduced, step, total]);

  /* ------ manual controls ------ */
  const play = () => {
    claim(idRef.current);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const restart = () => {
    resetTransient();
    setStepIdx(0);
    play();
  };
  const stepBack = () => {
    pause();
    setStepIdx((i) => Math.max(0, i - 1));
  };
  const stepFwd = () => {
    pause();
    setStepIdx((i) => Math.min(total - 1, i + 1));
  };

  /* ------ camera transform (zoom to hotspot centre) ------ */
  const camera = useMemo(() => {
    if (!step) return { scale: 1, tx: 0, ty: 0 };
    const { x, y, w, h } = step.hotspot;
    // scale so the larger of (w,h) fills ZOOM_COVERAGE of the frame
    const scale = Math.min(3.5, ZOOM_COVERAGE * 100 / Math.max(w, h));
    // hotspot centre in %
    const cx = x + w / 2;
    const cy = y + h / 2;
    // translate so the centre lands in the middle of the frame after scaling
    const tx = (50 - cx) * scale;
    const ty = (50 - cy) * scale;
    return { scale, tx, ty };
  }, [step]);

  const finalTypedText = step?.action === "type" && step.text
    ? (reduced ? step.text : step.text.slice(0, typedChars))
    : "";

  return (
    <div ref={rootRef} className={cn("w-full", className)}>
      {title && (
        <div className="font-display text-sm font-semibold text-foreground mb-2">{title}</div>
      )}

      {/* 16:9 frame */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Camera wrapper: scales/translates the screenshot */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `scale(${camera.scale}) translate(${camera.tx}%, ${camera.ty}%)`,
            transformOrigin: "50% 50%",
            transition: reduced ? "none" : "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <img
            src={shot}
            alt={shotAlt}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />

          {/* Scrim + highlight ring (only for highlight action) */}
          {step && step.action === "highlight" && (
            <>
              <div
                className="pointer-events-none absolute inset-0 bg-background/55"
                style={{
                  WebkitMaskImage: `radial-gradient(ellipse ${step.hotspot.w * 0.75}% ${step.hotspot.h * 0.75}% at ${step.hotspot.x + step.hotspot.w / 2}% ${step.hotspot.y + step.hotspot.h / 2}%, transparent 55%, black 100%)`,
                  maskImage: `radial-gradient(ellipse ${step.hotspot.w * 0.75}% ${step.hotspot.h * 0.75}% at ${step.hotspot.x + step.hotspot.w / 2}% ${step.hotspot.y + step.hotspot.h / 2}%, transparent 55%, black 100%)`,
                }}
              />
              <div
                className="pointer-events-none absolute rounded-md ring-2 ring-[hsl(22_100%_54%)]"
                style={{
                  left: `${step.hotspot.x}%`,
                  top: `${step.hotspot.y}%`,
                  width: `${step.hotspot.w}%`,
                  height: `${step.hotspot.h}%`,
                  boxShadow: "0 0 0 6px hsl(22 100% 54% / 0.15), 0 0 30px 4px hsl(22 100% 54% / 0.45)",
                }}
              />
            </>
          )}

          {/* Typing chip anchored inside hotspot */}
          {step && step.action === "type" && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `${step.hotspot.x}%`,
                top: `${step.hotspot.y}%`,
                width: `${step.hotspot.w}%`,
                minHeight: `${step.hotspot.h}%`,
              }}
            >
              <div className="flex h-full flex-col justify-center gap-1 rounded-md border border-[hsl(22_100%_54%)]/60 bg-background/95 px-2 py-1 shadow-lg backdrop-blur">
                <div className="text-[8px] font-mono uppercase tracking-wider text-[hsl(22_100%_54%)]">
                  example
                </div>
                <div className="text-xs font-medium text-foreground">
                  {finalTypedText}
                  {!reduced && (
                    <span className="ml-0.5 inline-block h-3 w-0.5 bg-[hsl(22_100%_54%)] align-middle animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Animated cursor arrow at hotspot centre */}
          {!reduced && step && (
            <div
              className="pointer-events-none absolute z-30"
              style={{
                left: `${step.hotspot.x + step.hotspot.w / 2}%`,
                top: `${step.hotspot.y + step.hotspot.h / 2}%`,
                transform: "translate(-2px, -2px)",
                transition: "left 850ms cubic-bezier(0.22, 1, 0.36, 1), top 850ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <svg width="18" height="22" viewBox="0 0 18 22" className="drop-shadow-md">
                <path
                  d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z"
                  fill="white"
                  stroke="black"
                  strokeWidth="1.5"
                />
              </svg>
              {clickPulse > 0 && step.action === "click" && (
                <span
                  key={clickPulse}
                  className="absolute -left-4 -top-4 h-10 w-10 rounded-full border-2 border-[hsl(22_100%_54%)] animate-ping"
                />
              )}
            </div>
          )}
        </div>

        {/* Toast (outside camera so it doesn't scale) */}
        {toast && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-40 max-w-[70%] rounded-lg border border-border bg-foreground text-background px-3 py-2 text-xs font-medium shadow-xl animate-fade-in">
            {toast}
          </div>
        )}

        {/* Expand button */}
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="absolute top-2 right-2 z-40 rounded-md border border-border bg-background/80 p-1.5 text-foreground/80 backdrop-blur transition hover:bg-background"
          aria-label="View full screenshot"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Controls */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          aria-label="Restart"
        >
          <RotateCcw size={12} /> Restart
        </button>
        <button
          type="button"
          onClick={stepBack}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          aria-label="Step back"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          type="button"
          onClick={stepFwd}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          aria-label="Step forward"
        >
          <ChevronRight size={12} />
        </button>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {([0.5, 1, 2] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "px-1.5 py-0.5 text-[11px] rounded",
                speed === s
                  ? "bg-[hsl(22_100%_54%)] text-white"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground font-mono">
          Step {Math.min(stepIdx + 1, total)} of {total}
        </div>
      </div>

      {/* Caption strip */}
      <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
        {step?.caption ?? ""}
        {step?.narration && (
          <div className="mt-1 text-xs text-muted-foreground">{step.narration}</div>
        )}
      </div>

      {/* Written script */}
      <details className="mt-3 rounded-md border border-border bg-background/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Written steps
        </summary>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm text-foreground/90">
          {steps.map((s, i) => (
            <li key={i} className={cn(i === stepIdx && "font-semibold text-foreground")}>
              {s.caption}
            </li>
          ))}
        </ol>
      </details>

      <div className="sr-only" role="status" aria-live="polite">
        {step?.caption}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 rounded-md border border-border bg-background/80 p-2 text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <img
            src={shot}
            alt={shotAlt}
            className="max-h-[92vh] max-w-[96vw] rounded-lg border border-border shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
