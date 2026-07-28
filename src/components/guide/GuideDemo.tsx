import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type GuideAction =
  | "move"
  | "click"
  | "type"
  | "appear"
  | "toast"
  | "wait"
  | "scroll"
  | "drop";

export interface GuideStep {
  caption: string;
  action: GuideAction;
  target?: string;
  text?: string;
  ms?: number;
}

export interface GuideDemoProps {
  title?: string;
  steps: GuideStep[];
  /** JSX mock of the app screen. Refs on targets are resolved via `data-guide-ref` attributes. */
  mock: ReactNode;
  /** Aspect ratio for the frame, e.g. "16/10". Defaults to "16/10". */
  aspect?: string;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Utilities                                                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MS: Record<GuideAction, number> = {
  move: 900,
  click: 450,
  type: 1200,
  appear: 600,
  toast: 1600,
  wait: 800,
  scroll: 900,
  drop: 1400,
};

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

const useOnScreen = (ref: React.RefObject<HTMLElement | null>) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export const GuideDemo = ({
  title,
  steps,
  mock,
  aspect = "16/10",
  className,
}: GuideDemoProps) => {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(rootRef);

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [clickPulse, setClickPulse] = useState(0);
  const [typedText, setTypedText] = useState<Record<string, string>>({});
  const [appeared, setAppeared] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [dropFlash, setDropFlash] = useState<string | null>(null);

  const total = steps.length;
  const step = steps[stepIdx];

  /* --- Reset visual state whenever we jump back to step 0 -------------- */
  const resetVisuals = useCallback(() => {
    setTypedText({});
    setAppeared({});
    setToast(null);
    setDropFlash(null);
    setClickPulse(0);
  }, []);

  /* --- Resolve a target ref inside the mock ---------------------------- */
  const targetCentre = useCallback((target?: string) => {
    if (!target || !frameRef.current) return null;
    const el = frameRef.current.querySelector<HTMLElement>(`[data-guide-ref="${target}"]`);
    if (!el) return null;
    const frameRect = frameRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - frameRect.left + r.width / 2,
      y: r.top - frameRect.top + r.height / 2,
      w: r.width,
      h: r.height,
    };
  }, []);

  /* --- Step runner ----------------------------------------------------- */
  useEffect(() => {
    if (!playing || !step) return;
    let cancelled = false;
    const duration = (step.ms ?? DEFAULT_MS[step.action]) / speed;

    // apply the step effect
    const t = targetCentre(step.target);
    switch (step.action) {
      case "move":
      case "scroll":
        if (t) setCursor({ x: t.x, y: t.y });
        break;
      case "click":
        if (t) setCursor({ x: t.x, y: t.y });
        setClickPulse((n) => n + 1);
        if (step.target) setAppeared((a) => ({ ...a, [step.target!]: true }));
        break;
      case "type": {
        if (t) setCursor({ x: t.x, y: t.y });
        const full = step.text ?? "";
        if (reduced) {
          setTypedText((p) => ({ ...p, [step.target ?? "_"]: full }));
        } else {
          const key = step.target ?? "_";
          const start = performance.now();
          const tick = () => {
            if (cancelled) return;
            const elapsed = performance.now() - start;
            const frac = Math.min(1, elapsed / duration);
            const n = Math.floor(full.length * frac);
            setTypedText((p) => ({ ...p, [key]: full.slice(0, n) }));
            if (frac < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
        break;
      }
      case "appear":
        if (step.target) setAppeared((a) => ({ ...a, [step.target!]: true }));
        break;
      case "toast":
        setToast(step.text ?? step.caption);
        break;
      case "drop":
        if (step.target) setDropFlash(step.target);
        break;
      case "wait":
      default:
        break;
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (step.action === "toast") setToast(null);
      if (step.action === "drop") setDropFlash(null);
      const next = stepIdx + 1;
      if (next >= total) {
        // loop with 1.5s pause
        window.setTimeout(() => {
          if (cancelled) return;
          resetVisuals();
          setStepIdx(0);
        }, 1500 / speed);
      } else {
        setStepIdx(next);
      }
    }, duration);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, stepIdx, speed, reduced]);

  /* --- Autoplay when visible ------------------------------------------ */
  useEffect(() => {
    if (reduced) {
      // reduced motion: show final state of every step at once
      const allTyped: Record<string, string> = {};
      const allAppeared: Record<string, boolean> = {};
      for (const s of steps) {
        if (s.action === "type" && s.text) allTyped[s.target ?? "_"] = s.text;
        if ((s.action === "appear" || s.action === "click") && s.target) allAppeared[s.target] = true;
      }
      setTypedText(allTyped);
      setAppeared(allAppeared);
      setPlaying(false);
      return;
    }
    if (onScreen) setPlaying(true);
    else setPlaying(false);
  }, [onScreen, reduced, steps]);

  /* --- Controls -------------------------------------------------------- */
  const restart = () => {
    resetVisuals();
    setStepIdx(0);
    setPlaying(true);
  };
  const stepBack = () => {
    setPlaying(false);
    setStepIdx((i) => Math.max(0, i - 1));
  };
  const stepFwd = () => {
    setPlaying(false);
    setStepIdx((i) => Math.min(total - 1, i + 1));
  };

  /* --- Rendered mock context ------------------------------------------ */
  const ctx = useMemo(
    () => ({ typedText, appeared, dropFlash }),
    [typedText, appeared, dropFlash],
  );

  return (
    <div ref={rootRef} className={cn("w-full", className)}>
      {title && (
        <div className="font-display text-sm font-semibold text-foreground mb-2">{title}</div>
      )}

      {/* Frame */}
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        style={{ aspectRatio: aspect }}
      >
        <GuideMockContext.Provider value={ctx}>
          <div className="absolute inset-0">{mock}</div>
        </GuideMockContext.Provider>

        {/* Animated cursor */}
        {!reduced && (
          <div
            className="pointer-events-none absolute z-30 transition-all duration-700 ease-out"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: "translate(-4px, -2px)",
            }}
          >
            <svg width="18" height="22" viewBox="0 0 18 22" className="drop-shadow-md">
              <path
                d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z"
                fill="hsl(var(--foreground))"
                stroke="hsl(var(--background))"
                strokeWidth="1.5"
              />
            </svg>
            {clickPulse > 0 && (
              <span
                key={clickPulse}
                className="absolute -left-3 -top-3 h-8 w-8 rounded-full border-2 border-[hsl(22_100%_54%)] animate-ping"
              />
            )}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-40 max-w-[70%] rounded-lg border border-border bg-foreground text-background px-3 py-2 text-xs font-medium shadow-xl animate-fade-in">
            {toast}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
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
                speed === s ? "bg-[hsl(22_100%_54%)] text-white" : "text-muted-foreground hover:bg-muted",
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
      </div>

      {/* Full readable script */}
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

      {/* Live region for accessibility */}
      <div className="sr-only" role="status" aria-live="polite">
        {step?.caption}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Mock helpers                                                              */
/* -------------------------------------------------------------------------- */

import { createContext, useContext } from "react";

interface GuideMockCtx {
  typedText: Record<string, string>;
  appeared: Record<string, boolean>;
  dropFlash: string | null;
}
const GuideMockContext = createContext<GuideMockCtx>({
  typedText: {},
  appeared: {},
  dropFlash: null,
});

/** A field inside your mock that receives typed text via the "type" action. */
export const GuideField = ({
  refName,
  placeholder,
  className,
}: {
  refName: string;
  placeholder?: string;
  className?: string;
}) => {
  const { typedText } = useContext(GuideMockContext);
  const value = typedText[refName] ?? "";
  return (
    <div
      data-guide-ref={refName}
      className={cn(
        "min-h-[28px] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
        className,
      )}
    >
      {value || <span className="text-muted-foreground/70">{placeholder}</span>}
      <span className="ml-0.5 inline-block h-3 w-0.5 bg-[hsl(22_100%_54%)] align-middle animate-pulse" />
    </div>
  );
};

/** A block that only becomes visible after an "appear" or "click" targets it. */
export const GuideAppear = ({
  refName,
  children,
  className,
  as: Tag = "div",
}: {
  refName: string;
  children?: ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) => {
  const { appeared } = useContext(GuideMockContext);
  const on = appeared[refName];
  return (
    <Tag
      data-guide-ref={refName}
      className={cn(
        "transition-all duration-500",
        on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
        className,
      )}
    >
      {children}
    </Tag>
  );
};

/** A dashed drop-zone that flashes with a file icon on a "drop" action. */
export const GuideDropZone = ({
  refName,
  label = "Drop files here",
  className,
}: {
  refName: string;
  label?: string;
  className?: string;
}) => {
  const { dropFlash } = useContext(GuideMockContext);
  const active = dropFlash === refName;
  return (
    <div
      data-guide-ref={refName}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 text-xs text-muted-foreground transition-all",
        active
          ? "border-[hsl(22_100%_54%)] bg-[hsl(22_100%_54%)]/10 text-foreground"
          : "border-border bg-muted/30",
        className,
      )}
    >
      <FileText
        size={20}
        className={cn(
          "transition-all",
          active
            ? "text-[hsl(22_100%_54%)] -translate-y-1 animate-bounce"
            : "text-muted-foreground",
        )}
      />
      <span>{label}</span>
    </div>
  );
};

/** Generic ref anchor for move/click/scroll targets that are non-input elements. */
export const GuideAnchor = ({
  refName,
  children,
  className,
  as: Tag = "div",
}: {
  refName: string;
  children?: ReactNode | undefined;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) => (
  <Tag data-guide-ref={refName} className={className}>
    {children}
  </Tag>
);
