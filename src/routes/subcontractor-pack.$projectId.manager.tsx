import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, HardHat, ShieldCheck, MessagesSquare, CalendarRange, FileDown, ChevronRight, Users, PencilLine, History as HistoryIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { getProject } from "@/lib/projects.functions";
import { getManagerPack, getComplianceSignedUrl } from "@/lib/subcontractor-pack.functions";
import {
  createPackIssue,
  finalizePackIssue,
  listPackIssues,
  getPackIssueSignedUrl,
  PACK_BUCKET,
} from "@/lib/pack-archive.functions";
import { supabase } from "@/integrations/supabase/client";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { generateWeeklyPackPdf } from "@/lib/weekly-pack-pdf";
import { PackFormStack, RecordedByBadge } from "@/components/subcontractor/PackForms";


export const Route = createFileRoute("/subcontractor-pack/$projectId/manager")({
  head: () => ({ meta: [{ title: "Subcontractors Weekly Pack — Manager" }] }),
  component: ManagerPackPage,
});

type Sub = any;

function ManagerPackPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
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
    // A focus/mount refetch competing with an in-flight "record on behalf" POST
    // was one source of the intermittent `Failed to fetch`. Only refetch when
    // a save explicitly invalidates this key.
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 30_000,
  });

  if (project.isError) return <AccessDeniedScreen message={(project.error as Error)?.message} />;

  const subs: Sub[] = pack.data?.subcontractors ?? [];
  const active = useMemo(() => subs.find((s) => s.id === activeId) ?? null, [subs, activeId]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-7xl px-6 py-10">
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
          Subcontractors · Master View
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          {active
            ? `Deep-dive into ${active.company_name}'s live labour, compliance and look-ahead.`
            : "Executive directory of every subcontractor operating on this project."}
        </p>

        {pack.isLoading && (
          <div className="glass-panel mt-6 flex items-center gap-2 p-5 text-xs text-foreground/60">
            <Loader2 size={14} className="animate-spin" /> Loading directory…
          </div>
        )}

        {!active && pack.data && subs.length === 0 && (
          <div className="glass-panel mt-6 p-6 text-center text-xs text-foreground/60">
            No subcontractors registered on this project yet.
          </div>
        )}

        {!active && subs.length > 0 && (
          <div className="mt-8 flex flex-col gap-4">
            {subs.map((s) => (
              <SubCard key={s.id} sub={s} onOpen={() => setActiveId(s.id)} />
            ))}
          </div>
        )}


        {active && (
          <SubDetail
            sub={active}
            projectId={projectId}
            projectName={project.data?.name ?? "Project"}
            onBack={() => setActiveId(null)}
            onSaved={() => qc.invalidateQueries({ queryKey: ["manager-pack", projectId] })}
          />
        )}
      </div>
    </div>
  );
}

function SubCard({ sub, onOpen }: { sub: Sub; onOpen: () => void }) {
  const activeWorkers = sub.workers?.length ?? 0;
  const registers = sub.registers?.length ?? 0;
  const highRisk = (sub.lookAheads ?? []).some((l: any) => l.is_high_risk);
  const permit = (sub.lookAheads ?? []).some((l: any) => l.permit_required);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-panel group flex w-full items-center gap-6 p-6 text-left transition hover:border-alert/60 hover:shadow-[0_0_0_1px_rgba(255,122,0,0.45)] md:p-8"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border-2 border-alert/60 bg-alert/10 text-alert md:h-20 md:w-20">
        <HardHat size={32} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="truncate text-2xl font-extrabold uppercase leading-tight tracking-tight text-foreground md:text-3xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          {sub.company_name}
        </p>
        <p className="mt-1 text-[0.65rem] uppercase tracking-widest text-foreground/50">
          Manager · {sub.manager_name || "—"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sub.status === "pending" && (
            <span className="rounded-sm border border-amber-400 bg-amber-400/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-amber-300">
              Invite Pending
            </span>
          )}
          {sub.status === "active" && (
            <span className="rounded-sm border border-emerald-400 bg-emerald-400/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-emerald-300">
              Active
            </span>
          )}
          {highRisk && (
            <span className="rounded-sm border border-red-500 bg-red-600/20 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-red-300">
              High Risk
            </span>
          )}
          {permit && (
            <span className="rounded-sm border border-amber-400 bg-amber-400/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-amber-300">
              Permit
            </span>
          )}
        </div>
      </div>
      <div className="hidden shrink-0 grid-cols-3 gap-3 md:grid">
        <MiniStat icon={<Users size={12} />} label="Workers" value={activeWorkers} />
        <MiniStat icon={<ShieldCheck size={12} />} label="Registers" value={registers} />
        <MiniStat icon={<CalendarRange size={12} />} label="Talks" value={sub.toolboxTalks?.length ?? 0} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 rounded-md border border-alert/50 bg-alert/10 px-4 py-3 text-alert transition group-hover:bg-alert group-hover:text-black md:px-6 md:py-4">
        <span className="text-[0.7rem] font-extrabold uppercase tracking-widest">Open Pack</span>
        <ChevronRight size={18} />
      </div>
    </button>
  );
}


function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-foreground/50">
        {icon}
        <p className="text-[0.5rem] font-bold uppercase tracking-[0.28em]">{label}</p>
      </div>
      <p className="mt-0.5 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

type TabKey = "labour" | "registers" | "talks" | "lookahead" | "history" | "record";

function SubDetail({
  sub,
  projectId,
  projectName,
  onBack,
  onSaved,
}: {
  sub: Sub;
  projectId: string;
  projectName: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("labour");
  const [downloading, setDownloading] = useState(false);
  // Historical range — default to current week (Mon–Sun).
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState<string>(iso(monday));
  const [endDate, setEndDate] = useState<string>(iso(sunday));

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

  const filterByDate = <T,>(rows: T[]): T[] => {
    if (!startDate && !endDate) return rows;
    const from = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
    const to = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
    return rows.filter((r) => {
      const rec = r as { created_at?: string; date?: string; inspection_date?: string };
      const raw = rec.date || rec.inspection_date || rec.created_at;
      if (!raw) return true;
      const t = new Date(raw).getTime();
      return t >= from && t <= to;
    });
  };

  const filteredWorkers = filterByDate<any>(sub.workers ?? []);
  const filteredRegisters = filterByDate<any>(sub.registers ?? []);
  const filteredTalks = filterByDate<any>(sub.toolboxTalks ?? []);
  const filteredLookAheads = filterByDate<any>(sub.lookAheads ?? []);

  const createIssue = useServerFn(createPackIssue);
  const finalizeIssue = useServerFn(finalizePackIssue);
  const listIssues = useServerFn(listPackIssues);
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["pack-issues", projectId, sub.id],
    queryFn: () => listIssues({ data: { projectId, subcontractorId: sub.id } }),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const download = async () => {
    setDownloading(true);
    try {
      const { filename, blob } = await generateWeeklyPackPdf({
        projectName,
        companyName: sub.company_name,
        workers: filteredWorkers,
        registers: filteredRegisters,
        toolboxTalks: filteredTalks,
        lookAheads: filteredLookAheads,
        rangeStart: startDate || null,
        rangeEnd: endDate || null,
        resolveUrl: async (path: string) => {
          const { url } = await getSig({ data: { path } });
          return url;
        },
      });

      toast.success(`Weekly Pack Generated: ${filename}`);

      // Archive the pack exactly as issued — versioned, never overwritten.
      try {
        const issue = await createIssue({
          data: {
            projectId,
            subcontractorId: sub.id,
            rangeStart: startDate || null,
            rangeEnd: endDate || null,
            filename,
            counts: {
              labour: filteredWorkers.length,
              registers: filteredRegisters.length,
              talks: filteredTalks.length,
              lookAhead: filteredLookAheads.length,
            },
          },
        });
        const up = await supabase.storage
          .from(PACK_BUCKET)
          .upload(issue.storagePath, blob, { contentType: "application/pdf", upsert: false });
        if (up.error) throw new Error(up.error.message);
        await finalizeIssue({ data: { issueId: issue.id, byteSize: blob.size } });
        qc.invalidateQueries({ queryKey: ["pack-issues", projectId, sub.id] });
        qc.invalidateQueries({ queryKey: ["project-bible", projectId] });
        toast.success(`Archived to pack history (v${issue.version}).`);
      } catch (archiveErr) {
        toast.error(
          `Pack downloaded, but archiving failed — ${archiveErr instanceof Error ? archiveErr.message : "unknown error"}`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate pack");
    } finally {
      setDownloading(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "labour", label: "Labour", icon: <HardHat size={13} />, count: filteredWorkers.length },
    { key: "registers", label: "Safety Registers", icon: <ShieldCheck size={13} />, count: filteredRegisters.length },
    { key: "talks", label: "Toolbox Talks", icon: <MessagesSquare size={13} />, count: filteredTalks.length },
    { key: "lookahead", label: "Look-Ahead", icon: <CalendarRange size={13} />, count: filteredLookAheads.length },
    { key: "history", label: "Pack History", icon: <HistoryIcon size={13} />, count: history.data?.length ?? 0 },
    { key: "record", label: "Record On Behalf", icon: <PencilLine size={13} />, count: 0 },
  ];


  const dateInputCls =
    "rounded-md border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-[0.7rem] text-foreground outline-none focus:border-alert";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:text-foreground"
        >
          <ArrowLeft size={12} /> Directory
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
            <CalendarRange size={12} className="text-alert" />
            <span className="text-[0.55rem] font-bold uppercase tracking-widest text-foreground/60">From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={dateInputCls} />
            <span className="text-[0.55rem] font-bold uppercase tracking-widest text-foreground/60">To</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={dateInputCls} />
          </div>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-md border border-alert/60 bg-alert/15 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-widest text-alert hover:bg-alert/25 disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            {downloading ? "Generating…" : "Download Pack For Range"}
          </button>
        </div>
      </div>

      <div className="glass-panel mt-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.35em] text-alert">Subcontractor</p>
            <h2
              className="mt-1 text-3xl font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {sub.company_name}
            </h2>
            <p className="mt-1 text-xs text-foreground/60">
              Manager · <span className="text-foreground/80">{sub.manager_name || "—"}</span> · Since{" "}
              {new Date(sub.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[0.65rem] font-bold uppercase tracking-widest transition ${
                tab === t.key
                  ? "border-alert bg-alert/15 text-alert"
                  : "border-white/10 bg-black/30 text-foreground/60 hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
              {t.key !== "record" && (
                <span className="rounded-sm bg-black/40 px-1.5 py-0.5 font-mono text-[0.55rem] text-foreground/70">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "labour" && <LabourTable workers={filteredWorkers} onOpen={openDoc} />}
          {tab === "registers" && <RegisterTable registers={filteredRegisters} onOpen={openDoc} />}
          {tab === "talks" && <TalksTable talks={filteredTalks} />}
          {tab === "lookahead" && <LookAheadTable rows={filteredLookAheads} />}
          {tab === "history" && (
            <PackHistoryPanel issues={history.data ?? []} loading={history.isLoading} />
          )}

          {tab === "record" && (
            <div>
              <div className="mb-4 rounded-md border border-sky-400/40 bg-sky-400/5 p-4">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-sky-300">Record on behalf of</p>
                <p className="mt-1 text-sm text-foreground/80">
                  You are logging records for <span className="font-bold text-foreground">{sub.company_name}</span>.
                  Every entry saved here is stamped with your user id and shown as
                  <span className="mx-1 font-mono text-sky-300">RECORDED BY SITE MANAGER</span>
                  so the audit trail stays honest.
                </p>
              </div>
              <PackFormStack key={sub.id} subId={sub.id} projectId={projectId} onSaved={onSaved} onBehalf />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TableShell({ head, empty, children }: { head: string[]; empty: string; children: React.ReactNode }) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div className="overflow-x-auto rounded-md border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-black/40 text-[0.55rem] uppercase tracking-[0.28em] text-foreground/60">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {isEmpty ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-[0.7rem] italic text-foreground/50">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function LabourTable({ workers, onOpen }: { workers: any[]; onOpen: (p?: string | null) => void }) {
  return (
    <TableShell head={["Name", "Role", "Competency Card", "Logged"]} empty="No workers registered.">
      {workers.map((w) => (
        <tr key={w.id} className="hover:bg-white/[0.02]">
          <td className="px-3 py-2 font-bold text-foreground">
            <div className="flex flex-wrap items-center gap-2">
              {w.name}
              {w.recorded_by && <RecordedByBadge />}
            </div>
          </td>
          <td className="px-3 py-2 text-foreground/80">
            {w.role || "—"}
            {(w.card_type || w.card_number) && (
              <p className="mt-0.5 font-mono text-[0.6rem] text-foreground/50">
                {[w.card_type, w.card_number].filter(Boolean).join(" · ")}
                {w.card_expiry ? ` · exp ${new Date(w.card_expiry).toLocaleDateString()}` : ""}
              </p>
            )}
          </td>
          <td className="px-3 py-2">
            {w.competency_card_url ? (
              <button
                type="button"
                onClick={() => onOpen(w.competency_card_url)}
                className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-widest text-alert hover:underline"
              >
                <ExternalLink size={11} /> View Card
              </button>
            ) : (
              <span className="rounded-sm border border-red-500/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-red-300">
                Missing
              </span>
            )}
          </td>
          <td className="px-3 py-2 font-mono text-[0.65rem] text-foreground/60">
            {new Date(w.created_at).toLocaleDateString()}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function RegisterTable({ registers, onOpen }: { registers: any[]; onOpen: (p?: string | null) => void }) {
  return (
    <TableShell head={["Type", "Asset", "Inspection", "Certificate"]} empty="No registers logged.">
      {registers.map((r) => (
        <tr key={r.id} className="hover:bg-white/[0.02]">
          <td className="px-3 py-2">
            <span className="rounded-sm border border-alert/60 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert">
              {r.type}
            </span>
          </td>
          <td className="px-3 py-2 text-foreground/85">
            <div className="flex flex-wrap items-center gap-2">
              {r.asset_name || "—"}
              {r.recorded_by && <RecordedByBadge />}
            </div>
            {r.inspector && (
              <p className="mt-0.5 font-mono text-[0.6rem] text-foreground/50">Inspector · {r.inspector}</p>
            )}
          </td>
          <td className="px-3 py-2 font-mono text-[0.65rem] text-foreground/70">
            {r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : "—"}
            {r.next_inspection_due && (
              <p className="mt-0.5 text-foreground/50">Next · {new Date(r.next_inspection_due).toLocaleDateString()}</p>
            )}
          </td>
          <td className="px-3 py-2">
            {r.certificate_url ? (
              <button
                type="button"
                onClick={() => onOpen(r.certificate_url)}
                className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-widest text-alert hover:underline"
              >
                <ExternalLink size={11} /> View Cert
              </button>
            ) : (
              <span className="rounded-sm border border-red-500/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-red-300">
                Missing
              </span>
            )}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function TalksTable({ talks }: { talks: any[] }) {
  return (
    <TableShell head={["Date", "Topic", "Attendees", "Names"]} empty="No toolbox talks recorded.">
      {talks.map((t) => {
        const list = Array.isArray(t.attendance_list) ? t.attendance_list : [];
        return (
          <tr key={t.id} className="hover:bg-white/[0.02]">
            <td className="px-3 py-2 font-mono text-[0.65rem] text-foreground/70">
              {t.date ? new Date(t.date).toLocaleDateString() : ""}
            </td>
            <td className="px-3 py-2 font-bold text-foreground">
              <div className="flex flex-wrap items-center gap-2">
                {t.topic}
                {t.recorded_by && <RecordedByBadge />}
              </div>
              {t.presenter && (
                <p className="mt-0.5 font-mono text-[0.6rem] text-foreground/50">Presenter · {t.presenter}</p>
              )}
            </td>
            <td className="px-3 py-2 font-mono text-foreground/85">{list.length}</td>
            <td className="px-3 py-2 text-[0.7rem] text-foreground/60">
              {list.slice(0, 8).map((a: unknown) => String(a)).join(", ")}
              {list.length > 8 ? "…" : ""}
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function LookAheadTable({ rows }: { rows: any[] }) {
  return (
    <TableShell head={["Date", "Work Plan", "Flags"]} empty="No look-ahead entries.">
      {rows.map((l) => {
        const flagged = l.is_high_risk || l.permit_required;
        return (
          <tr key={l.id} className={flagged ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-white/[0.02]"}>
            <td className="px-3 py-2 align-top font-mono text-[0.65rem] text-foreground/70">
              {l.date ? new Date(l.date).toLocaleDateString() : ""}
            </td>
            <td className="px-3 py-2 align-top text-foreground/85">
              <p className="whitespace-pre-wrap">{l.work_plan}</p>
              {l.recorded_by && (
                <div className="mt-1">
                  <RecordedByBadge />
                </div>
              )}
            </td>
            <td className="px-3 py-2 align-top">
              <div className="flex flex-wrap gap-1">
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
                {!flagged && <span className="text-[0.6rem] text-foreground/40">—</span>}
              </div>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}
