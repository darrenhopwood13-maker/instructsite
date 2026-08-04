import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TourStep } from "./tour-steps";

/* -------------------------------------------------------------------------- */
/*  Live guided tour overlay.                                                 */
/*                                                                            */
/*  Reuses the visual language of GuideDemo's "highlight" action (dimmed      */
/*  backdrop with a cutout, orange ring glow) but NEVER scales or pans the    */
/*  real page: the app stays at 1:1 and fully clickable throughout.           */
/* -------------------------------------------------------------------------- */

const ACCENT = "hsl(22 100% 54%)";
/** How long we hunt for a target before showing the "waiting" state. */
const FIND_TIMEOUT_MS = 6000;
const POLL_MS = 120;
const PAD = 8;
const CARD_W = 340;
const CARD_GAP = 18;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

type CardSide = "bottom" | "top" | "right" | "left";

function placeCard(rect: Rect, vw: number, vh: number) {
  const cardH = 220;
  let side: CardSide = "bottom";
  if (rect.top + rect.height + CARD_GAP + cardH < vh) side = "bottom";
  else if (rect.top - CARD_GAP - cardH > 0) side = "top";
  else if (rect.left + rect.width + CARD_GAP + CARD_W < vw) side = "right";
  else side = "left";

  let left: number;
  let top: number;
  if (side === "bottom" || side === "top") {
    left = rect.left + rect.width / 2 - CARD_W / 2;
    top = side === "bottom" ? rect.top + rect.height + CARD_GAP : rect.top - CARD_GAP - cardH;
  } else {
    left = side === "right" ? rect.left + rect.width + CARD_GAP : rect.left - CARD_GAP - CARD_W;
    top = rect.top + rect.height / 2 - cardH / 2;
  }
  left = Math.min(Math.max(12, left), vw - CARD_W - 12);
  top = Math.min(Math.max(12, top), vh - cardH - 12);
  return { side, left, top };
}

export interface LiveTourOverlayProps {
  steps: TourStep[];
  index: number;
  onIndex: (i: number) => void;
  onExit: () => void;
}

export function LiveTourOverlay({ steps, index, onIndex, onExit }: LiveTourOverlayProps) {
  const step = steps[index];
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [rect, setRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const targetRef = useRef<Element | null>(null);

  /* -- navigate to the step's route ------------------------------------- */
  useEffect(() => {
    if (!step) return;
    if (pathname !== step.route) {
      // Use href (raw URL) rather than `to`, so literal paths are never
      // re-resolved against a route id (e.g. `/projects_/$id/bible`).
      router.history.push(step.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.route, index]);

  /* -- hunt for the target ------------------------------------------------ */
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    setRect(null);
    setWaiting(false);
    targetRef.current = null;

    const hunt = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target);
      if (el) {
        targetRef.current = el;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        // Let the smooth scroll settle before measuring.
        setTimeout(() => {
          if (cancelled) return;
          setRect(rectOf(el));
          setWaiting(false);
        }, 350);
        return;
      }
      if (Date.now() - startedAt > FIND_TIMEOUT_MS) setWaiting(true);
      timer = setTimeout(hunt, POLL_MS);
    };
    hunt();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.target, index, pathname]);

  /* -- keep the spotlight glued to the element --------------------------- */
  const sync = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected) return;
    const next = rectOf(el);
    setRect((prev) => (sameRect(prev, next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    if (!rect) return;
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    const id = window.setInterval(sync, 500);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
      window.clearInterval(id);
    };
  }, [rect, sync]);

  /* -- keyboard ----------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight") onIndex(Math.min(index + 1, steps.length - 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, steps.length, onExit, onIndex]);

  if (!step) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;
  const place = spot ? placeCard(spot, vw, vh) : null;
  const isLast = index === steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" data-live-tour="">
      {/* Dimmed backdrop with a real cutout — four panels so the highlighted
          element stays genuinely clickable. */}
      {spot ? (
        <>
          <div
            className="pointer-events-none fixed left-0 right-0 top-0 bg-background/70 backdrop-blur-[1px] transition-all duration-200"
            style={{ height: Math.max(0, spot.top) }}
          />
          <div
            className="pointer-events-none fixed left-0 right-0 bg-background/70 backdrop-blur-[1px] transition-all duration-200"
            style={{ top: spot.top + spot.height, bottom: 0 }}
          />
          <div
            className="pointer-events-none fixed left-0 bg-background/70 backdrop-blur-[1px] transition-all duration-200"
            style={{ top: spot.top, height: spot.height, width: Math.max(0, spot.left) }}
          />
          <div
            className="pointer-events-none fixed right-0 bg-background/70 backdrop-blur-[1px] transition-all duration-200"
            style={{
              top: spot.top,
              height: spot.height,
              left: spot.left + spot.width,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-lg ring-2 transition-all duration-200"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--tw-ring-color" as any]: ACCENT,
              boxShadow: `0 0 0 6px hsl(22 100% 54% / 0.15), 0 0 30px 4px hsl(22 100% 54% / 0.45)`,
            }}
          />
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-background/70 backdrop-blur-[1px]" />
      )}

      {/* Card */}
      <div
        className="pointer-events-auto fixed w-[340px] rounded-xl border border-white/10 bg-card/95 p-4 shadow-2xl backdrop-blur"
        style={
          place
            ? { top: place.top, left: place.left }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        {place && (
          <span
            aria-hidden
            className="absolute h-3 w-3 rotate-45 border border-white/10 bg-card"
            style={
              place.side === "bottom"
                ? { top: -7, left: "50%", marginLeft: -6, borderRight: "none", borderBottom: "none" }
                : place.side === "top"
                  ? { bottom: -7, left: "50%", marginLeft: -6, borderLeft: "none", borderTop: "none" }
                  : place.side === "right"
                    ? { left: -7, top: "50%", marginTop: -6, borderRight: "none", borderTop: "none" }
                    : { right: -7, top: "50%", marginTop: -6, borderLeft: "none", borderBottom: "none" }
            }
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: ACCENT }}>
            Step {index + 1} of {steps.length}
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit tour"
            className="-mr-1 -mt-1 rounded p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <h3 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-3 rounded-md border border-white/10 bg-background/60 px-2.5 py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Do this
          </div>
          <div className="mt-0.5 text-xs font-medium text-foreground">{step.action}</div>
        </div>

        {waiting && !rect && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-200">
            <Loader2 size={12} className="animate-spin" />
            Waiting for this screen to finish loading…
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExit}
            className="text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-widest transition",
                index === 0
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : "text-foreground hover:bg-white/5",
              )}
            >
              <ChevronLeft size={12} /> Back
            </button>
            <button
              type="button"
              onClick={() => (isLast ? onExit() : onIndex(index + 1))}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              {isLast ? "Finish" : "Next"} <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
