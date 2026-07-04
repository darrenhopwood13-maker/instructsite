import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, ClipboardList } from "lucide-react";
import { getProject } from "@/lib/projects.functions";
import { listProjectDrawings, listProjectZones } from "@/lib/tier1-uploads.functions";
import { createActivity, listProjectActivities } from "@/lib/activities.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/dabs/$projectId")({
  head: () => ({ meta: [{ title: "DABS — Site Operations Oracle" }] }),
  component: DabsPage,
});

const RISK = [
  { id: "working_at_height", label: "Working at Height" },
  { id: "hot_works", label: "Hot Works" },
  { id: "confined_space", label: "Confined Space" },
];

function DabsPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const qc = useQueryClient();
  const getP = useServerFn(getProject);
  const drawingsFn = useServerFn(listProjectDrawings);
  const zonesFn = useServerFn(listProjectZones);
  const actsFn = useServerFn(listProjectActivities);
  const createFn = useServerFn(createActivity);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });
  const drawings = useQuery({
    queryKey: ["drawings", projectId],
    queryFn: () => drawingsFn({ data: { projectId } }),
    enabled: ready,
  });
  const zones = useQuery({
    queryKey: ["zones", projectId],
    queryFn: () => zonesFn({ data: { projectId } }),
    enabled: ready,
  });
  const activities = useQuery({
    queryKey: ["activities", projectId],
    queryFn: () => actsFn({ data: { projectId } }),
    enabled: ready,
  });

  const [drawingId, setDrawingId] = useState<string>("");
  const [zoneId, setZoneId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleFlag = (f: string) =>
    setFlags((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({
        data: {
          projectId,
          drawingId: drawingId || undefined,
          zoneId: zoneId || undefined,
          description,
          highRiskFlags: flags as any,
        },
      });
      setDescription("");
      setFlags([]);
      qc.invalidateQueries({ queryKey: ["activities", projectId] });
    } finally {
      setBusy(false);
    }
  };

  const permitRequired = flags.length > 0;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> {project.data?.name ?? "Project"}
        </Link>

        <h1
          className="mt-3 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          DABS · Daily Activity
        </h1>

        <form onSubmit={submit} className="glass-panel mt-8 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
                Active Project Drawing
              </span>
              <select
                value={drawingId}
                onChange={(e) => setDrawingId(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
              >
                <option value="">— Select drawing —</option>
                {drawings.data?.filter((d: any) => d.is_active).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.drawing_no ?? "?"} · Rev {d.revision ?? "?"} · {d.title ?? "untitled"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
                Work Zone / Level
              </span>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
              >
                <option value="">— Select zone —</option>
                {zones.data?.map((z: any) => (
                  <option key={z.id} value={z.id} disabled={z.status === "closed"}>
                    {z.name}
                    {z.level ? ` · ${z.level}` : ""} ({z.source})
                    {z.status === "closed" ? " — CLOSED" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
              Activity Description
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert"
              placeholder="What are you doing on site today?"
              required
            />
          </label>

          <div className="mt-4">
            <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
              High-Risk Activities
            </p>
            <div className="flex flex-wrap gap-2">
              {RISK.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleFlag(r.id)}
                  className={`rounded-sm border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-widest ${
                    flags.includes(r.id)
                      ? "border-alert bg-alert/20 text-alert"
                      : "border-white/15 text-foreground/70 hover:border-white/40"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {permitRequired && (
            <div className="mt-4 flex items-center gap-2 rounded-md border-2 border-alert bg-alert/10 p-3 text-sm text-alert">
              <AlertTriangle size={16} />
              <span>
                <strong className="uppercase tracking-widest">Permit Required.</strong> Submitting this activity will flash a live alert on the Site Manager's dashboard until a permit is issued.
              </span>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={busy || !description.trim()}
              className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
            >
              <ClipboardList size={14} /> {busy ? "Logging…" : "Log Activity"}
            </button>
          </div>
        </form>

        <section className="mt-10">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
            Recent Activities
          </h2>
          <ul className="mt-3 space-y-2">
            {activities.data?.map((a: any) => (
              <li key={a.id} className="glass-panel p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{a.description}</p>
                    <p className="mt-0.5 text-[0.65rem] uppercase tracking-widest text-foreground/50">
                      {a.project_drawings?.drawing_no ?? "No drawing"} ·{" "}
                      {a.work_zones?.name ?? "No zone"}
                    </p>
                  </div>
                  {a.permit_status === "required" && (
                    <span className="rounded-sm bg-alert px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-black">
                      Permit Required
                    </span>
                  )}
                  {a.permit_status === "active" && (
                    <span className="rounded-sm border border-emerald-400/50 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-emerald-400">
                      Permit Active
                    </span>
                  )}
                </div>
              </li>
            ))}
            {activities.data && activities.data.length === 0 && (
              <li className="glass-panel p-4 text-center text-xs text-foreground/50">
                No activities logged yet.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
