import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { getProject } from "@/lib/projects.functions";
import { listProjectActivities, issuePermit } from "@/lib/activities.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/site-manager/$projectId")({
  head: () => ({ meta: [{ title: "Site Manager Dashboard" }] }),
  component: SiteManagerPage,
});

function SiteManagerPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const qc = useQueryClient();
  const getP = useServerFn(getProject);
  const actsFn = useServerFn(listProjectActivities);
  const permitFn = useServerFn(issuePermit);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });
  const activities = useQuery({
    queryKey: ["activities", projectId],
    queryFn: () => actsFn({ data: { projectId } }),
    enabled: ready,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!ready) return;
    const ch = supabase
      .channel(`activities-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["activities", projectId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, ready, qc]);

  const required = (activities.data ?? []).filter((a: any) => a.permit_status === "required");
  const active = (activities.data ?? []).filter((a: any) => a.permit_status === "active");

  const grant = async (activityId: string, permitType: string) => {
    await permitFn({
      data: { projectId, activityId, permitType: permitType as any, validHours: 8 },
    });
    qc.invalidateQueries({ queryKey: ["activities", projectId] });
  };

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
          Site Manager · Live
        </h1>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
              Permit Required
            </h2>
            <span className="font-mono text-[0.7rem] text-foreground/60">
              {required.length} open
            </span>
          </div>

          {required.length === 0 ? (
            <div className="glass-panel mt-3 p-6 text-center text-sm text-foreground/60">
              <ShieldCheck className="mx-auto mb-2 text-emerald-400" size={22} />
              All high-risk activities are covered by an active permit.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {required.map((a: any) => (
                <li
                  key={a.id}
                  className="permit-flash rounded-lg border-2 border-alert bg-alert/10 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 text-alert" size={22} />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-alert">
                          Permit Required
                        </p>
                        <p className="mt-1 text-foreground">{a.description}</p>
                        <p className="mt-1 text-[0.65rem] uppercase tracking-widest text-foreground/60">
                          {a.project_drawings?.drawing_no ?? "no drawing"} ·{" "}
                          {a.work_zones?.name ?? "no zone"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.high_risk_flags?.map((f: string) => (
                            <span
                              key={f}
                              className="rounded-sm border border-alert/50 bg-black/30 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-alert"
                            >
                              {f.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {(a.high_risk_flags ?? []).map((f: string) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => grant(a.id, f)}
                          className="glass-btn rounded-md px-3 py-1.5 text-[0.65rem] uppercase tracking-widest"
                        >
                          Issue {f.replace(/_/g, " ")} Permit
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-emerald-400">
            Active Permits
          </h2>
          <ul className="mt-3 space-y-2">
            {active.map((a: any) => (
              <li key={a.id} className="glass-panel flex items-center gap-3 p-3">
                <ShieldCheck size={16} className="text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{a.description}</p>
                </div>
                <span className="rounded-sm border border-emerald-400/40 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-emerald-400">
                  Active
                </span>
              </li>
            ))}
            {active.length === 0 && (
              <li className="text-xs text-foreground/50">No active permits.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
