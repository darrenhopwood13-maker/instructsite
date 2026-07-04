import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { listZoneCompletion } from "@/lib/daily-diary.functions";

interface ZoneStat {
  name: string;
  level: string | null;
  pct: number;
  complete: boolean;
}

export function IfcMeshStatus({ projectId }: { projectId: string }) {
  const listFn = useServerFn(listZoneCompletion);
  const q = useQuery({
    queryKey: ["zone-completion", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    refetchInterval: 15000,
  });

  // Reduce most-recent completion per zone
  const byZone = new Map<string, ZoneStat>();
  for (const r of (q.data ?? []) as any[]) {
    if (!r.zone_id || byZone.has(r.zone_id)) continue;
    byZone.set(r.zone_id, {
      name: r.work_zones?.name ?? "Zone",
      level: r.work_zones?.level ?? null,
      pct: r.completion_pct ?? 0,
      complete: r.ifc_synced === true,
    });
  }
  const zones = Array.from(byZone.values());

  return (
    <div>
      <h2 className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
        <Box size={12} /> IFC Model · Zone Mesh Status
      </h2>
      <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
        Orange = in progress · Green = 100% verified by QS
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {zones.map((z) => (
          <span
            key={z.name + (z.level ?? "")}
            className={`inline-flex items-center gap-2 rounded-md border-2 px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-widest ${
              z.complete
                ? "border-green-500 bg-green-500/15 text-green-400"
                : "border-alert bg-alert/10 text-alert"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                z.complete ? "bg-green-400" : "bg-alert animate-pulse"
              }`}
            />
            {z.name}
            {z.level ? ` · ${z.level}` : ""} · {z.pct}%
          </span>
        ))}
        {zones.length === 0 && (
          <span className="text-xs text-foreground/50">No diary data yet.</span>
        )}
      </div>
    </div>
  );
}
