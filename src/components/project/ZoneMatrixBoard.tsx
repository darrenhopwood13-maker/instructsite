import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Activity, CheckCircle2, Circle } from "lucide-react";
import { listZoneRuntimeState, listIfcModels } from "@/lib/ifc-models.functions";

type ZoneRuntime = {
  zone_id: string;
  name: string;
  level: string | null;
  state: "unstarted" | "live" | "complete";
  progress_pct: number;
};

/**
 * 2D Zone Matrix Board — the fallback viewport when the project has no active
 * IFC model. Renders every extracted work_zone as an interactive tile whose
 * fill/outline reflect cumulative approved diary progress and live pin state.
 */
export function ZoneMatrixBoard({ projectId }: { projectId: string }) {
  const runtimeFn = useServerFn(listZoneRuntimeState);
  const ifcFn = useServerFn(listIfcModels);

  const ifcModels = useQuery({
    queryKey: ["ifc-models", projectId],
    queryFn: () => ifcFn({ data: { projectId } }),
  });

  const runtime = useQuery({
    queryKey: ["zone-runtime", projectId],
    queryFn: () => runtimeFn({ data: { projectId } }),
    refetchInterval: 5000,
  });

  const hasActiveModel = (ifcModels.data ?? []).some((m: any) => m.is_active);
  // Only render fallback when no active IFC model exists.
  if (ifcModels.isLoading) return null;
  if (hasActiveModel) return null;

  const zones = (runtime.data ?? []) as ZoneRuntime[];

  const grouped = zones.reduce<Record<string, ZoneRuntime[]>>((acc, z) => {
    const key = z.level?.trim() || "Unassigned";
    (acc[key] ||= []).push(z);
    return acc;
  }, {});

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            2D Fallback Viewport
          </p>
          <h2
            className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Zone Progress Matrix
          </h2>
          <p className="mt-1 text-xs text-foreground/60">
            Live source of truth from extracted logistics zones · updates as approved
            subcontractor diaries hit each zone.
          </p>
        </div>
        <LayoutGrid className="text-alert/70" size={28} />
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.6rem] font-mono uppercase tracking-widest text-foreground/70">
        <span className="inline-flex items-center gap-1.5">
          <Circle size={10} className="text-foreground/40" /> Unstarted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Activity size={10} className="text-alert" /> Live
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={10} className="text-emerald-400" /> Complete
        </span>
      </div>

      {zones.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-black/40 p-10 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-foreground/50">
            No zones extracted yet
          </p>
          <p className="mt-2 text-sm text-foreground/70">
            Upload a logistics plan or create zones manually from the Master Admin HUD.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {Object.entries(grouped).map(([level, list]) => (
            <div key={level}>
              <p className="mb-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">
                {level}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {list.map((z) => (
                  <ZoneTile key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ZoneTile({ zone }: { zone: ZoneRuntime }) {
  const complete = zone.state === "complete";
  const live = zone.state === "live";

  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl border p-4 transition",
        complete
          ? "border-emerald-400/70 bg-emerald-500/25 shadow-[0_0_25px_rgba(34,197,94,0.35)]"
          : live
            ? "border-alert bg-black/70 shadow-[0_0_25px_rgba(255,120,0,0.35)] animate-pulse-slow"
            : "border-white/12 bg-black/50 hover:border-white/30",
      ].join(" ")}
      style={
        live
          ? { animation: "zone-live-outline 1.8s ease-in-out infinite" }
          : undefined
      }
    >
      <style>{`
        @keyframes zone-live-outline {
          0%, 100% { box-shadow: 0 0 12px rgba(255,120,0,0.25), inset 0 0 0 1px rgba(255,120,0,0.6); }
          50%      { box-shadow: 0 0 30px rgba(255,140,0,0.75), inset 0 0 0 2px rgba(255,160,0,1); }
        }
      `}</style>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-black uppercase tracking-wide ${
              complete ? "text-emerald-50" : "text-foreground"
            }`}
          >
            {zone.name}
          </p>
          {zone.level && (
            <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60">
              {zone.level}
            </p>
          )}
        </div>
        {complete ? (
          <CheckCircle2 size={16} className="shrink-0 text-emerald-200" />
        ) : live ? (
          <Activity size={16} className="shrink-0 text-alert" />
        ) : (
          <Circle size={16} className="shrink-0 text-foreground/40" />
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between font-mono text-[0.55rem] uppercase tracking-widest">
          <span className={complete ? "text-emerald-100" : "text-foreground/60"}>
            Progress
          </span>
          <span className={complete ? "text-emerald-50" : "text-foreground/90"}>
            {zone.progress_pct}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              complete
                ? "bg-emerald-300"
                : live
                  ? "bg-alert"
                  : "bg-foreground/40"
            }`}
            style={{ width: `${Math.max(4, zone.progress_pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
