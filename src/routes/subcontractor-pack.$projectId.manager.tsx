import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { getProject } from "@/lib/projects.functions";
import { getManagerPack, getComplianceSignedUrl } from "@/lib/subcontractor-pack.functions";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";

export const Route = createFileRoute("/subcontractor-pack/$projectId/manager")({
  head: () => ({ meta: [{ title: "Subcontractors Weekly Pack — Manager" }] }),
  component: ManagerPackPage,
});

function ManagerPackPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);
  const getP = useServerFn(getProject);
  const getPackFn = useServerFn(getManagerPack);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });
  const pack = useQuery({
    queryKey: ["manager-pack", projectId],
    queryFn: () => getPackFn({ data: { projectId } }),
    enabled: ready,
  });

  if (project.isError) return <AccessDeniedScreen message={(project.error as Error)?.message} />;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/site-manager/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> {project.data?.name ?? "Project"} · Command Tower
        </Link>
        <h1
          className="mt-3 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Subcontractors Weekly Pack
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          Aggregate live compliance, labour and look-ahead data for every subcontractor on this project.
        </p>

        {pack.isLoading && (
          <div className="glass-panel mt-6 flex items-center gap-2 p-5 text-xs text-foreground/60">
            <Loader2 size={14} className="animate-spin" /> Loading pack…
          </div>
        )}

        {pack.data && pack.data.subcontractors.length === 0 && (
          <div className="glass-panel mt-6 p-6 text-center text-xs text-foreground/60">
            No subcontractors have submitted data yet.
          </div>
        )}

        <div className="mt-6 space-y-4">
          {pack.data?.subcontractors.map((s: any) => <SubRow key={s.id} sub={s} />)}
        </div>
      </div>
    </div>
  );
}

function SubRow({ sub }: { sub: any }) {
  const [open, setOpen] = useState(false);
  const getSig = useServerFn(getComplianceSignedUrl);
  const openDoc = async (path?: string | null) => {
    if (!path) return;
    try {
      const { url } = await getSig({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot open file");
    }
  };
  const latestTalk = sub.toolboxTalks?.[0];
  const latestAhead = sub.lookAheads?.[0];
  return (
    <div className="glass-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-2 items-center gap-3 px-5 py-4 text-left md:grid-cols-6"
      >
        <div className="col-span-2 flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <div>
            <p
              className="text-base font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {sub.company_name}
            </p>
            <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
              since {new Date(sub.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Stat label="Workers" value={sub.workers.length} />
        <Stat label="Registers" value={sub.registers.length} />
        <Stat label="Last Talk" value={latestTalk?.date ? new Date(latestTalk.date).toLocaleDateString() : "—"} />
        <div className="flex flex-wrap gap-1">
          {latestAhead?.is_high_risk && (
            <span className="rounded-sm border border-red-500 bg-red-600/20 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-red-300">
              High Risk
            </span>
          )}
          {latestAhead?.permit_required && (
            <span className="rounded-sm border border-amber-400 bg-amber-400/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-amber-300">
              Permit
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-white/10 p-5 lg:grid-cols-2">
          <Block title="Labour Roster">
            {sub.workers.length === 0 && <Empty>No workers.</Empty>}
            {sub.workers.map((w: any) => (
              <Row key={w.id}>
                <div>
                  <p className="text-sm font-bold text-foreground">{w.name}</p>
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">{w.role || "—"}</p>
                </div>
                {w.competency_card_url && (
                  <button type="button" onClick={() => openDoc(w.competency_card_url)} className="text-[0.6rem] uppercase tracking-widest text-alert hover:underline">
                    <ExternalLink size={11} className="inline" /> Card
                  </button>
                )}
              </Row>
            ))}
          </Block>
          <Block title="Registers">
            {sub.registers.length === 0 && <Empty>No registers.</Empty>}
            {sub.registers.map((r: any) => (
              <Row key={r.id}>
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-alert/60 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert">
                    {r.type}
                  </span>
                  <p className="text-sm text-foreground">{r.asset_name || "—"}</p>
                </div>
                {r.certificate_url && (
                  <button type="button" onClick={() => openDoc(r.certificate_url)} className="text-[0.6rem] uppercase tracking-widest text-alert hover:underline">
                    <ExternalLink size={11} className="inline" /> Cert
                  </button>
                )}
              </Row>
            ))}
          </Block>
          <Block title="Toolbox Talks">
            {sub.toolboxTalks.length === 0 && <Empty>No talks.</Empty>}
            {sub.toolboxTalks.map((t: any) => {
              const list = Array.isArray(t.attendance_list) ? t.attendance_list : [];
              return (
                <Row key={t.id}>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t.topic}</p>
                    <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                      {list.length} attendees
                    </p>
                  </div>
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {t.date ? new Date(t.date).toLocaleDateString() : ""}
                  </p>
                </Row>
              );
            })}
          </Block>
          <Block title="Look-Aheads">
            {sub.lookAheads.length === 0 && <Empty>No look-aheads.</Empty>}
            {sub.lookAheads.map((l: any) => (
              <div key={l.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                <p className="whitespace-pre-wrap text-sm text-foreground/85">{l.work_plan}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {l.date ? new Date(l.date).toLocaleDateString() : ""}
                  </span>
                  {l.is_high_risk && (
                    <span className="rounded-sm border border-red-500 bg-red-600/20 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-red-300">
                      High Risk
                    </span>
                  )}
                  {l.permit_required && (
                    <span className="rounded-sm border border-amber-400 bg-amber-400/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-amber-300">
                      Permit
                    </span>
                  )}
                </div>
              </div>
            ))}
          </Block>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.28em] text-foreground/50">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-foreground/50">{children}</p>;
}
