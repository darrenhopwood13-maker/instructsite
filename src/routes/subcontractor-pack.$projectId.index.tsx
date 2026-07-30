import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { isOwnerEmail } from "@/lib/owner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { getProject } from "@/lib/projects.functions";
import {
  getMyCompanyForProject,
  getSubcontractorPack,
  getComplianceSignedUrl,
} from "@/lib/subcontractor-pack.functions";
import { generateWeeklyPackPdf } from "@/lib/weekly-pack-pdf";
import { PackFormStack } from "@/components/subcontractor/PackForms";

import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";

export const Route = createFileRoute("/subcontractor-pack/$projectId/")({
  head: () => ({ meta: [{ title: "Subcontractors Pack — InstructSite" }] }),
  component: SubPackPage,
});

type Tab = "hub" | "log";

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">{eyebrow}</p>
      <h2
        className="mt-1 text-xl font-extrabold uppercase tracking-tight text-foreground"
        style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
      >
        {title}
      </h2>
    </div>
  );
}

function inputCls() {
  return "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert";
}

function primaryBtn(extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md border-2 border-alert bg-alert/10 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-alert hover:bg-alert hover:text-black transition-colors ${extra}`;
}

function ghostBtn(extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert ${extra}`;
}

function SubPackPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("hub");
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLocked, setCompanyLocked] = useState(false);

  const navigate = useNavigate();
  useEffect(() => {
    ensureOracleSession().then(async (user) => {
      // Master admin / project admin / founder → jump straight to Master View.
      const email = user?.email ?? null;
      if (isOwnerEmail(email)) {
        navigate({ to: "/subcontractor-pack/$projectId/manager", params: { projectId }, replace: true });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roleSet = new Set((roles ?? []).map((r: any) => r.role));
      if (roleSet.has("master_admin") || roleSet.has("project_admin") || roleSet.has("site_manager")) {
        navigate({ to: "/subcontractor-pack/$projectId/manager", params: { projectId }, replace: true });
        return;
      }
      setReady(true);
    });
  }, [projectId, navigate]);

  const getP = useServerFn(getProject);
  const getCoFn = useServerFn(getMyCompanyForProject);
  const getPackFn = useServerFn(getSubcontractorPack);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });

  const myCompany = useQuery({
    queryKey: ["my-company", projectId],
    queryFn: () => getCoFn({ data: { projectId } }),
    enabled: ready,
  });

  useEffect(() => {
    const c = myCompany.data?.companyName;
    if (c && !companyLocked) {
      setCompanyName(c);
      setCompanyLocked(true);
    }
  }, [myCompany.data, companyLocked]);

  const pack = useQuery({
    queryKey: ["sub-pack", projectId, companyName],
    queryFn: () => getPackFn({ data: { projectId, companyName } }),
    enabled: ready && companyLocked && !!companyName,
  });

  const subId = pack.data?.subcontractor?.id as string | undefined;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sub-pack", projectId, companyName] });

  if (project.isError) return <AccessDeniedScreen message={(project.error as Error)?.message} />;
  if (!ready) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
        <div className="aurora-bg" />
        <div className="grain-overlay" />
        <div className="relative mx-auto flex max-w-6xl items-center gap-2 px-6 py-14 text-xs uppercase tracking-widest text-foreground/60">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/dabs/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> {project.data?.name ?? "Project"} · DABS
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Subcontractors Pack
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              {companyLocked ? companyName : "Set your company to begin"} · Weekly compliance & labour submission
            </p>
          </div>
          <SubmitWeeklyPackButton
            disabled={!pack.data || !companyLocked}
            projectName={project.data?.name ?? "Project"}
            companyName={companyName}
            pack={pack.data}
          />
        </div>

        {!companyLocked && (
          <div className="glass-panel mt-6 p-5">
            <SectionHeader eyebrow="Setup" title="Confirm your company" />
            <p className="mt-2 text-xs text-foreground/60">
              We couldn't detect your company from an invite. Enter it once — it'll be linked to this project.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name (e.g. Apex Electrical Ltd)"
                className={inputCls() + " max-w-md"}
              />
              <button
                type="button"
                onClick={() => companyName.trim() && setCompanyLocked(true)}
                className={primaryBtn()}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {companyLocked && (
          <>
            <div className="mt-6 inline-flex rounded-md border border-white/15 bg-black/30 p-1">
              {(["hub", "log"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.28em] transition-colors ${
                    tab === t ? "bg-alert text-black" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {t === "hub" ? "Hub" : "Daily Log"}
                </button>
              ))}
            </div>

            {pack.isLoading && (
              <div className="glass-panel mt-6 flex items-center gap-2 p-5 text-xs text-foreground/60">
                <Loader2 size={14} className="animate-spin" /> Loading pack…
              </div>
            )}

            {tab === "hub" && pack.data && <HubView pack={pack.data} />}
            {tab === "log" && subId && <div className="mt-6"><PackFormStack subId={subId} projectId={projectId} onSaved={invalidate} /></div>}
          </>
        )}
      </div>
    </div>
  );
}

function SubmitWeeklyPackButton({
  disabled,
  projectName,
  companyName,
  pack,
}: {
  disabled: boolean;
  projectName: string;
  companyName: string;
  pack: any;
}) {
  const [busy, setBusy] = useState(false);
  const getSig = useServerFn(getComplianceSignedUrl);
  const onClick = async () => {
    if (!pack) return;
    setBusy(true);
    try {
      const { filename } = await generateWeeklyPackPdf({
        projectName,
        companyName,
        workers: pack.workers ?? [],
        registers: pack.registers ?? [],
        toolboxTalks: pack.toolboxTalks ?? [],
        lookAheads: pack.lookAheads ?? [],
        resolveUrl: async (path: string) => {
          const { url } = await getSig({ data: { path } });
          return url;
        },
      });
      toast.success("Weekly Pack Generated Successfully", { description: filename });

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={primaryBtn(disabled || busy ? "opacity-70 cursor-not-allowed" : "")}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      {busy ? "Generating Pack…" : "Submit Weekly Pack"}
    </button>
  );
}


function HubView({ pack }: { pack: any }) {
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
  const latestAhead = pack.lookAheads?.[0];
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Labour Roster" title={`${pack.workers.length} active`} />
        <ul className="mt-4 space-y-2">
          {pack.workers.length === 0 && (
            <li className="text-xs text-foreground/50">No workers logged yet.</li>
          )}
          {pack.workers.map((w: any) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{w.name}</p>
                <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {w.role || "—"}
                </p>
              </div>
              {w.competency_card_url && (
                <button type="button" onClick={() => openDoc(w.competency_card_url)} className={ghostBtn()}>
                  <ExternalLink size={11} /> Card
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Equipment Registers" title={`${pack.registers.length} assets`} />
        <ul className="mt-4 space-y-2">
          {pack.registers.length === 0 && (
            <li className="text-xs text-foreground/50">No registers yet.</li>
          )}
          {pack.registers.map((r: any) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-alert/60 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert">
                    {r.type}
                  </span>
                  <p className="truncate text-sm font-bold text-foreground">{r.asset_name || "—"}</p>
                </div>
                <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : "No date"}
                </p>
              </div>
              {r.certificate_url && (
                <button type="button" onClick={() => openDoc(r.certificate_url)} className={ghostBtn()}>
                  <ExternalLink size={11} /> Cert
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Recent Toolbox Talks" title={`${pack.toolboxTalks.length} recent`} />
        <ul className="mt-4 space-y-2">
          {pack.toolboxTalks.length === 0 && (
            <li className="text-xs text-foreground/50">No talks logged.</li>
          )}
          {pack.toolboxTalks.slice(0, 5).map((t: any) => {
            const attendees = Array.isArray(t.attendance_list) ? t.attendance_list : [];
            return (
              <li key={t.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">{t.topic || "—"}</p>
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {t.date ? new Date(t.date).toLocaleDateString() : ""}
                  </p>
                </div>
                <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {attendees.length} attendees
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Current Look-Ahead" title={latestAhead ? new Date(latestAhead.date).toLocaleDateString() : "Nothing planned"} />
        {latestAhead ? (
          <div className="mt-4 space-y-3">
            <p className="whitespace-pre-wrap text-sm text-foreground/85">{latestAhead.work_plan}</p>
            <div className="flex flex-wrap gap-2">
              {latestAhead.is_high_risk && (
                <span className="rounded-sm border border-red-500 bg-red-600/20 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-red-300">
                  High Risk
                </span>
              )}
              {latestAhead.permit_required && (
                <span className="rounded-sm border border-amber-400 bg-amber-400/10 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-amber-300">
                  Permit Required
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-foreground/50">Add a look-ahead in the Daily Log tab.</p>
        )}
      </div>
    </div>
  );
}
