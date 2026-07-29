import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Maximize2, X, Volume2, VolumeX } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { getGuideNarration } from "@/lib/narration.functions";

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
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GuideStep {
  caption: string;
  narration?: ReactNode;
  action: GuideAction;
  hotspot: GuideHotspot;
  text?: string;
  ms?: number;
  shot?: { url: string };
}

export interface GuideDemoProps {
  title?: string;
  steps: GuideStep[];
  shot: string;
  shotAlt: string;
  className?: string;
}

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
const ZOOM_COVERAGE = 0.7;
const SOUND_PREF_KEY = "guide-demo:sound";

/* -------------------------------------------------------------------------- */
/*  Shared narration cache (one per page, not per player).                    */
/* -------------------------------------------------------------------------- */

interface NarrationEntry {
  url: string | null;
  expiresAt: number;
}
/** Signed URLs live 30 min server-side; refresh 2 min early. */
const NARRATION_TTL_MS = 30 * 60 * 1000;
const NARRATION_REFRESH_MARGIN_MS = 2 * 60 * 1000;
/** Negative results are retried sooner. */
const NARRATION_FAILURE_TTL_MS = 60 * 1000;
const narrationCache = new Map<string, NarrationEntry>();

/* -------------------------------------------------------------------------- */
/*  Singleton registry — one player animates at a time.                       */
/* -------------------------------------------------------------------------- */

type Pauser = () => void;
const registry = new Set<{ id: symbol; pause: Pauser; visible: boolean }>();
let active: symbol | null = null;
/** A player the user explicitly started — never pre-empted by autoplay. */
let userDriven: symbol | null = null;

/** Returns true when this player may play. */
function claim(id: symbol, deliberate = false): boolean {
  if (deliberate) {
    userDriven = id;
  } else if (userDriven && userDriven !== id) {
    return false;
  }
  if (active === id) return true;
  for (const entry of registry) {
    if (entry.id !== id) entry.pause();
  }
  active = id;
  return true;
}
function release(id: symbol) {
  if (active === id) active = null;
  if (userDriven === id) userDriven = null;
}

/** Set playback rate without chipmunking the voice. */
function setRate(el: HTMLAudioElement, rate: number) {
  el.playbackRate = rate;
  const anyEl = el as HTMLAudioElement & {
    preservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
    mozPreservesPitch?: boolean;
  };
  anyEl.preservesPitch = true;
  anyEl.webkitPreservesPitch = true;
  anyEl.mozPreservesPitch = true;
}


/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Recursively flatten a ReactNode into plain text for TTS/subtitles. */
function narrationToText(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(narrationToText).join("");
  if (typeof node === "object") {
    const maybe = node as unknown as { props?: { children?: ReactNode } };
    if (maybe.props && "children" in maybe.props) {
      return narrationToText(maybe.props.children);
    }
  }
  return "";
}

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

  /* ---- sound state ---- */
  const [soundOn, setSoundOn] = useState<boolean>(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Real ElevenLabs clip is driving the current step. */
  const audioActiveRef = useRef(false);
  /** Unscaled clip length in ms (0 = unknown yet). */
  const audioDurationRef = useRef(0);
  const audioEndedRef = useRef(false);
  /** Bumped on loadedmetadata/ended so the rAF effect re-evaluates. */
  const [audioTick, setAudioTick] = useState(0);
  /** Bumped by Restart to force a replay of the same line. */
  const [replayTick, setReplayTick] = useState(0);
  /** One retry per step after a decode/network error. */
  const audioRetryRef = useRef(false);
  const fetchNarration = useServerFn(getGuideNarration);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(SOUND_PREF_KEY);
      if (saved === "1") setSoundOn(true);
    } catch {
      /* ignore */
    }
  }, []);

  const persistSoundPref = useCallback((on: boolean) => {
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const total = steps.length;
  const step = steps[stepIdx];
  const narrationText = useMemo(() => narrationToText(step?.narration).trim(), [step]);

  /* ---- visibility gating ---- */
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

  /* ---- registry ---- */
  useEffect(() => {
    const id = idRef.current;
    const entry = { id, pause: () => setPlaying(false), visible: false };
    registry.add(entry);
    return () => {
      registry.delete(entry);
      release(id);
    };
  }, []);

  /* ---- autoplay (never pre-empts a user-driven player) ---- */
  useEffect(() => {
    if (reduced) {
      setPlaying(false);
      return;
    }
    const eligible = inView && tabVisible;
    if (eligible) {
      if (claim(idRef.current)) setPlaying(true);
    } else {
      if (active === idRef.current || userDriven === idRef.current) release(idRef.current);
      setPlaying(false);
    }
  }, [inView, tabVisible, reduced]);

  /* ---- narration loader (shared cache, expiry-aware, next-step preload) ---- */
  const loadNarration = useCallback(
    async (text: string, force = false): Promise<string | null> => {
      if (!text) return null;
      const now = Date.now();
      const hit = narrationCache.get(text);
      if (!force && hit && hit.expiresAt - NARRATION_REFRESH_MARGIN_MS > now) {
        return hit.url;
      }
      try {
        const res = await fetchNarration({ data: { text } });
        const url = res?.url ?? null;
        narrationCache.set(text, {
          url,
          expiresAt: now + (url ? NARRATION_TTL_MS : NARRATION_FAILURE_TTL_MS),
        });
        return url;
      } catch (err) {
        console.warn("[GuideDemo] narration fetch failed", err);
        narrationCache.set(text, { url: null, expiresAt: now + NARRATION_FAILURE_TTL_MS });
        return null;
      }
    },
    [fetchNarration],
  );


  /* ---- speechSynthesis fallback ---- */
  const speakFallback = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return false;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = speed;
        utter.lang = "en-GB";
        window.speechSynthesis.speak(utter);
        return true;
      } catch {
        return false;
      }
    },
    [speed],
  );

  const stopAllAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }, []);

  /* ---- play current-step audio when sound is on & unlocked & playing ---- */
  useEffect(() => {
    if (!soundOn || !audioUnlocked || !playing || !narrationText) {
      audioActiveRef.current = false;
      stopAllAudio();
      return;
    }
    let cancelled = false;
    const el = audioRef.current;
    const onMeta = () => {
      if (!el || !Number.isFinite(el.duration)) return;
      audioDurationRef.current = el.duration * 1000;
      setAudioTick((n) => n + 1);
    };
    const onEnded = () => {
      audioEndedRef.current = true;
      setAudioTick((n) => n + 1);
    };
    el?.addEventListener("loadedmetadata", onMeta);
    el?.addEventListener("ended", onEnded);

    (async () => {
      const url = await loadNarration(narrationText);
      if (cancelled) return;
      if (url && el) {
        if (el.src !== url) el.src = url;
        el.playbackRate = speed;
        try {
          await el.play();
          audioActiveRef.current = true;
          audioEndedRef.current = false;
          if (Number.isFinite(el.duration)) audioDurationRef.current = el.duration * 1000;
          setAudioTick((n) => n + 1);
          setAudioNotice(null);
        } catch {
          audioActiveRef.current = false;
          const ok = speakFallback(narrationText);
          setAudioNotice(ok ? "Using device voice." : null);
          setAudioTick((n) => n + 1);
        }
      } else {
        audioActiveRef.current = false;
        const ok = speakFallback(narrationText);
        setAudioNotice(ok ? "Using device voice." : "Narration unavailable — subtitles only.");
        setAudioTick((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
      el?.removeEventListener("loadedmetadata", onMeta);
      el?.removeEventListener("ended", onEnded);
      audioActiveRef.current = false;
      stopAllAudio();
    };
  }, [soundOn, audioUnlocked, playing, narrationText, loadNarration, speakFallback, speed, stopAllAudio]);


  /* ---- keep playbackRate in sync with speed ---- */
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  /* ---- preload NEXT step's audio while current one plays ---- */
  useEffect(() => {
    if (!soundOn) return;
    const next = steps[stepIdx + 1];
    if (!next) return;
    const nextText = narrationToText(next.narration).trim();
    if (!nextText) return;
    loadNarration(nextText).catch(() => undefined);
  }, [stepIdx, steps, soundOn, loadNarration]);

  /* ---- pause audio when the player is not eligible ---- */
  useEffect(() => {
    if (!playing || !inView || !tabVisible) stopAllAudio();
  }, [playing, inView, tabVisible, stopAllAudio]);

  useEffect(() => () => stopAllAudio(), [stopAllAudio]);

  /* ---- single RAF loop per player ---- */
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
    resetTransient();
    if (step?.action === "click") setClickPulse((n) => n + 1);
    if (step?.action === "toast") setToast(step.text ?? step.caption);
    stepStartRef.current = 0;
    audioDurationRef.current = 0;
    audioEndedRef.current = false;
    audioActiveRef.current = false;
  }, [stepIdx, step, resetTransient]);

  useEffect(() => {
    if (!playing || !step || reduced) return;

    const baseMs = step.ms ?? DEFAULT_MS[step.action];
    // Silent readers still need time to read the line: ~2.6 words/second.
    const words = narrationText ? narrationText.split(/\s+/).filter(Boolean).length : 0;
    const readMs = words ? (words / 2.6) * 1000 : 0;
    const visualDuration = baseMs / speed;
    const silentDuration = Math.max(baseMs, readMs) / speed;
    let cancelled = false;

    const loop = (t: number) => {
      if (cancelled) return;
      if (stepStartRef.current === 0) stepStartRef.current = t - pausedElapsedRef.current;
      const elapsed = t - stepStartRef.current;

      const withAudio = audioActiveRef.current;
      const audioMs = audioDurationRef.current ? audioDurationRef.current / speed : 0;
      // Effective step length = max(visual, audio) when a real clip is playing.
      const duration = withAudio ? Math.max(visualDuration, audioMs) : silentDuration;
      const frac = Math.min(1, elapsed / duration);

      if (step.action === "type" && step.text) {
        // Typing keeps its own (visual) cadence regardless of narration length.
        const typeFrac = Math.min(1, elapsed / visualDuration);
        const n = Math.floor(step.text.length * typeFrac);
        setTypedChars((prev) => (prev === n ? prev : n));
      }

      // Never cut the voice off: wait for both the visuals and the clip.
      const audioDone = !withAudio || audioEndedRef.current;

      if (frac >= 1 && audioDone) {
        pausedElapsedRef.current = 0;
        stepStartRef.current = 0;
        const next = stepIdx + 1;
        if (next >= total) {
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
  }, [playing, stepIdx, speed, reduced, step, total, narrationText, audioTick]);

  /* ---- manual controls ---- */
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

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    persistSoundPref(next);
    if (!next) {
      stopAllAudio();
    } else if (!audioUnlocked) {
      // A direct user gesture — unlock audio too.
      setAudioUnlocked(true);
    }
  };

  const startWithSound = () => {
    setSoundOn(true);
    setAudioUnlocked(true);
    persistSoundPref(true);
    play();
  };

  /* ---- camera transform ---- */
  const camera = useMemo(() => {
    if (!step) return { scale: 1, tx: 0, ty: 0 };
    const { x, y, w, h } = step.hotspot;
    const scale = Math.min(3.5, ZOOM_COVERAGE * 100 / Math.max(w, h));
    const cx = x + w / 2;
    const cy = y + h / 2;
    const tx = (50 - cx) * scale;
    const ty = (50 - cy) * scale;
    return { scale, tx, ty };
  }, [step]);

  const finalTypedText = step?.action === "type" && step.text
    ? (reduced ? step.text : step.text.slice(0, typedChars))
    : "";

  const activeShot = step?.shot?.url ?? shot;

  /* Show subtitles when: sound is off, or sound is on but audio hasn't been
     unlocked yet (i.e. before the "Start with sound" gesture). */
  const showSubtitles = !soundOn || !audioUnlocked;
  const showStartOverlay = soundOn && !audioUnlocked;

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
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `scale(${camera.scale}) translate(${camera.tx}%, ${camera.ty}%)`,
            transformOrigin: "50% 50%",
            transition: reduced ? "none" : "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <img
            src={activeShot}
            alt={shotAlt}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />

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

        {toast && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-40 max-w-[70%] rounded-lg border border-border bg-foreground text-background px-3 py-2 text-xs font-medium shadow-xl animate-fade-in">
            {toast}
          </div>
        )}

        {/* Subtitles */}
        {showSubtitles && narrationText && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 flex justify-center">
            <div className="max-w-[92%] rounded-md bg-black/75 px-3 py-1.5 text-center text-xs font-medium text-white shadow-lg backdrop-blur-sm">
              {narrationText}
            </div>
          </div>
        )}

        {/* Start-with-sound overlay */}
        {showStartOverlay && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <button
              type="button"
              onClick={startWithSound}
              className="inline-flex items-center gap-2 rounded-lg bg-[hsl(22_100%_54%)] px-4 py-2 text-sm font-semibold text-white shadow-xl transition hover:brightness-110"
            >
              <Volume2 size={16} /> Start with sound
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="absolute top-2 right-2 z-40 rounded-md border border-border bg-background/80 p-1.5 text-foreground/80 backdrop-blur transition hover:bg-background"
          aria-label="View full screenshot"
        >
          <Maximize2 size={14} />
        </button>

        {/* Hidden audio element */}
        <audio ref={audioRef} preload="auto" className="hidden" />
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
        <button
          type="button"
          onClick={toggleSound}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
            soundOn
              ? "border-[hsl(22_100%_54%)] bg-[hsl(22_100%_54%)]/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}
          aria-label={soundOn ? "Turn narration off" : "Turn narration on"}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
          {soundOn ? "Sound on" : "Sound off"}
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

      {audioNotice && (
        <div className="mt-1 text-[11px] text-muted-foreground italic">{audioNotice}</div>
      )}

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
            src={activeShot}
            alt={shotAlt}
            className="max-h-[92vh] max-w-[96vw] rounded-lg border border-border shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
