import { Link } from "@tanstack/react-router";
import { Sparkles, MapPin } from "lucide-react";

export type Zone = {
  id: string;
  name: string;
  level?: string | null;
  source?: string | null;
};

const PALETTE = [
  { fill: "rgba(255,120,0,0.18)", border: "rgba(255,120,0,0.65)", label: "text-alert" },
  { fill: "rgba(56,189,248,0.16)", border: "rgba(56,189,248,0.65)", label: "text-sky-300" },
  { fill: "rgba(52,211,153,0.16)", border: "rgba(52,211,153,0.65)", label: "text-emerald-300" },
  { fill: "rgba(196,181,253,0.16)", border: "rgba(196,181,253,0.65)", label: "text-violet-300" },
  { fill: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.65)", label: "text-amber-300" },
  { fill: "rgba(244,114,182,0.16)", border: "rgba(244,114,182,0.65)", label: "text-pink-300" },
];

function letterFor(index: number) {
  return String.fromCharCode(65 + (index % 26));
}

export function ZoneMap({
  zones,
  selectedId,
  onSelect,
  onLockOracle,
}: {
  zones: Zone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLockOracle: (payload: { kind: "zone"; id: string; label: string }) => void;
}) {
  const selected = zones.find((z) => z.id === selectedId) ?? null;
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(zones.length || 1))));

  return (
    <div className="glass-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
            DABS Work Zones
          </h3>
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-widest text-foreground/50">
            Click a zone to lock Oracle context
          </p>
        </div>
        <span className="font-mono text-[0.7rem] text-foreground/60">{zones.length}</span>
      </div>

      {zones.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/15 bg-black/25 p-6 text-center text-xs text-foreground/50">
          No zones extracted yet. Upload a GA drawing or logistics plan.
        </div>
      ) : (
        <>
          <div
            className="relative overflow-hidden rounded-lg border border-white/12 bg-[radial-gradient(circle_at_top,rgba(255,120,0,0.08),transparent_60%)] p-3"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
            <div
              className="relative grid gap-2"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {zones.map((z, i) => {
                const c = PALETTE[i % PALETTE.length];
                const letter = letterFor(i);
                const active = z.id === selectedId;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => onSelect(z.id)}
                    className={`group relative flex min-h-24 flex-col items-start justify-between rounded-md border p-3 text-left transition-all ${
                      active ? "scale-[1.02] shadow-[0_0_24px_rgba(255,120,0,0.35)]" : "hover:scale-[1.01]"
                    }`}
                    style={{
                      background: c.fill,
                      borderColor: active ? "rgba(255,120,0,0.9)" : c.border,
                      borderWidth: active ? 2 : 1,
                    }}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`font-mono text-[0.6rem] font-bold uppercase tracking-widest ${c.label}`}
                      >
                        Zone {letter}
                      </span>
                      {z.level && (
                        <span className="rounded-sm border border-white/20 bg-black/40 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/70">
                          L{z.level}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 w-full">
                      <p
                        className="line-clamp-2 text-sm font-extrabold uppercase tracking-tight text-foreground"
                        style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
                      >
                        {z.name}
                      </p>
                      {z.source && (
                        <p className="mt-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                          via {z.source}
                        </p>
                      )}
                    </div>
                    {active && (
                      <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 animate-pulse rounded-full bg-alert" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-alert/40 bg-alert/10 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-foreground/85">
                <MapPin size={12} className="text-alert" />
                <span className="font-mono uppercase tracking-widest">
                  Locked: {selected.name}
                  {selected.level ? ` · L${selected.level}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onLockOracle({
                      kind: "zone",
                      id: selected.id,
                      label: `${selected.name}${selected.level ? ` · L${selected.level}` : ""}`,
                    })
                  }
                  className="glass-orange inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[0.6rem] uppercase tracking-widest"
                >
                  <Sparkles size={10} /> Lock to Oracle
                </button>
                <Link
                  to="/oracle"
                  search={
                    {
                      zoneId: selected.id,
                      label: `${selected.name}${selected.level ? ` · L${selected.level}` : ""}`,
                    } as never
                  }
                  onClick={() =>
                    onLockOracle({
                      kind: "zone",
                      id: selected.id,
                      label: `${selected.name}${selected.level ? ` · L${selected.level}` : ""}`,
                    })
                  }
                  className="glass-btn inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[0.6rem] uppercase tracking-widest"
                >
                  Ask Oracle
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
