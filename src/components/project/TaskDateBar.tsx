import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import {
  daysBetween,
  durationOf,
  isoDay,
  shiftDay,
  slideTask,
  withDuration,
} from "@/lib/short-term-programme";

type Dated = { startDate: string; endDate: string };

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Thumb-friendly date control for short-term programme tasks.
 *
 * Deliberately not a native date input: on site this gets used one-handed on a
 * phone. A scrollable day strip sets start and finish by tapping, and the
 * slide / duration steppers cover the common "push it a day" and "give it
 * another two days" edits without opening anything.
 */
export function TaskDateBar({
  value,
  onChange,
  anchor,
}: {
  value: Dated;
  onChange: (next: Dated) => void;
  /** Day the strip is centred on — usually the programme start. */
  anchor?: string;
}) {
  const [mode, setMode] = useState<"start" | "end">("start");
  const stripRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const base = anchor ?? value.startDate ?? isoDay(new Date());
    return Array.from({ length: 56 }, (_, i) => shiftDay(base, i - 7));
  }, [anchor, value.startDate]);

  const duration = durationOf(value);

  const tapDay = (day: string) => {
    if (mode === "start") {
      const keep = duration;
      onChange(withDuration({ ...value, startDate: day, endDate: day }, keep));
    } else {
      if (daysBetween(value.startDate, day) < 0) return;
      onChange({ ...value, endDate: day });
    }
  };

  const inRange = (day: string) =>
    daysBetween(value.startDate, day) >= 0 && daysBetween(day, value.endDate) >= 0;

  return (
    <div className="rounded-md border border-white/15 bg-black/30 p-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(["start", "end"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-sm border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-widest transition ${
              mode === m
                ? "border-alert bg-alert/20 text-alert"
                : "border-white/15 text-foreground/60"
            }`}
          >
            {m === "start" ? "Start" : "Finish"} · {m === "start" ? value.startDate : value.endDate}
          </button>
        ))}

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Move one day earlier"
            onClick={() => onChange(slideTask(value, -1))}
            className="rounded-sm border border-white/15 p-1.5 text-foreground/70 hover:border-white/40"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            aria-label="Move one day later"
            onClick={() => onChange(slideTask(value, 1))}
            className="rounded-sm border border-white/15 p-1.5 text-foreground/70 hover:border-white/40"
          >
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            aria-label="Shorten by one day"
            onClick={() => onChange(withDuration(value, duration - 1))}
            className="rounded-sm border border-white/15 p-1.5 text-foreground/70 hover:border-white/40"
          >
            <Minus size={13} />
          </button>
          <span className="min-w-[3.2rem] text-center font-mono text-[0.65rem] text-foreground/80">
            {duration}d
          </span>
          <button
            type="button"
            aria-label="Extend by one day"
            onClick={() => onChange(withDuration(value, duration + 1))}
            className="rounded-sm border border-white/15 p-1.5 text-foreground/70 hover:border-white/40"
          >
            <Plus size={13} />
          </button>
        </span>
      </div>

      <div
        ref={stripRef}
        className="flex snap-x gap-1 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {days.map((d) => {
          const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
          const weekend = dow === 0 || dow === 6;
          const isStart = d === value.startDate;
          const isEnd = d === value.endDate;
          return (
            <button
              key={d}
              type="button"
              onClick={() => tapDay(d)}
              className={`min-w-[2.75rem] shrink-0 snap-start rounded-sm border px-1 py-1.5 text-center transition ${
                isStart || isEnd
                  ? "border-alert bg-alert text-black"
                  : inRange(d)
                    ? "border-alert/50 bg-alert/15 text-foreground"
                    : weekend
                      ? "border-white/10 bg-black/40 text-foreground/35"
                      : "border-white/15 text-foreground/70 hover:border-white/40"
              }`}
            >
              <span className="block font-mono text-[0.5rem] uppercase tracking-widest">
                {WEEKDAY[dow]}
              </span>
              <span className="block text-xs font-bold">{d.slice(8)}</span>
              <span className="block font-mono text-[0.45rem] uppercase tracking-widest opacity-70">
                {d.slice(5, 7)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[0.55rem] uppercase tracking-widest text-foreground/40">
        Tap a day to set the {mode === "start" ? "start" : "finish"} · duration is kept when you move
        the start
      </p>
    </div>
  );
}
