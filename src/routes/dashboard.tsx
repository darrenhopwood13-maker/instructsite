import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  ClipboardCheck,
  Flame,
  HardHat,
  Radio,
  ShieldAlert,
  Users,
} from "lucide-react";
import { getPortfolioSummary } from "@/lib/portfolio.functions";
import { getMyRoles } from "@/lib/projects.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Portfolio Command Center · Director Dashboard" },
      {
        name: "description",
        content:
          "Executive multi-project portfolio: live manpower, pending valuations, active permits, and cross-site safety alerts.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const rolesFn = useServerFn(getMyRoles);
  const summaryFn = useServerFn(getPortfolioSummary);

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
  });

  const roles = rolesQ.data?.roles ?? [];
  const canView =
    roles.includes("master_admin") || roles.includes("project_admin");

  const summary = useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: () => summaryFn(),
    enabled: ready && canView,
    refetchInterval: 15000,
  });

  if (!ready || rolesQ.isLoading) {
    return <PageShell><div className="p-10 text-sm text-neutral-500">Loading portfolio…</div></PageShell>;
  }

  if (!canView) {
    return (
      <PageShell>
        <div className="mx-auto mt-16 max-w-lg rounded-lg border-2 border-neutral-900 bg-white p-8 text-center shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
          <ShieldAlert className="mx-auto text-neutral-900" size={32} />
          <h2 className="mt-3 text-lg font-black uppercase tracking-widest text-neutral-900">
            Executive Access Only
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            The Portfolio Command Center is restricted to master admins and
            project admins.
          </p>
        </div>
      </PageShell>
    );
  }

  const totals = summary.data?.totals;
  const projects = summary.data?.projects ?? [];
  const alerts = summary.data?.alerts ?? [];

  return (
    <PageShell>
      <header className="border-b-2 border-neutral-900/90 pb-6">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.4em] text-neutral-500">
          Director Portfolio
        </p>
        <h1
          className="mt-2 text-3xl font-black tracking-tight text-neutral-900 sm:text-4xl md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Command Center
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Cross-project intelligence — live manpower, pending valuations,
          active permits, and a real-time safety alert stream across the entire
          contract portfolio.
        </p>
      </header>

      {/* Section A: Macro HUD */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Building2 size={16} />} label="Active Projects" value={totals?.activeProjects ?? 0} tone="ok" />
        <Stat icon={<HardHat size={16} />} label="Live Manpower" value={totals?.totalManpower ?? 0} tone="ok" />
        <Stat icon={<ClipboardCheck size={16} />} label="Pending Valuations" value={totals?.pendingValuations ?? 0} tone={((totals?.pendingValuations ?? 0) > 0) ? "warn" : "ok"} />
        <Stat icon={<Flame size={16} />} label="Active High-Risk Permits" value={totals?.activePermits ?? 0} tone={((totals?.activePermits ?? 0) > 0) ? "alert" : "ok"} />
      </section>

      {/* Sections B + C */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Section B: Project Grid */}
        <section>
          <SectionHeader title="Live Project Grid" subtitle="Section B" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {projects.length === 0 && (
              <div className="col-span-full rounded-lg border-2 border-dashed border-neutral-400 bg-white p-8 text-center text-sm text-neutral-500">
                No projects in portfolio yet.
              </div>
            )}
            {projects.map((p: any) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        </section>

        {/* Section C: Alert Stream */}
        <section>
          <SectionHeader title="Global Safety Alert Stream" subtitle="Section C" />
          <div className="mt-4 rounded-lg border-2 border-neutral-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
              <Radio size={12} className="animate-pulse text-red-500" />
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-neutral-500">
                Live Portfolio Feed
              </span>
            </div>
            <ul className="max-h-[640px] divide-y divide-neutral-100 overflow-auto">
              {alerts.length === 0 && (
                <li className="p-6 text-center text-xs uppercase tracking-widest text-neutral-400">
                  All quiet · no active alerts
                </li>
              )}
              {alerts.map((a: any) => (
                <AlertRow key={a.id} a={a} />
              ))}
            </ul>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

/* ---------------- ui bits ---------------- */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F4F5F6] text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">{children}</div>
    </div>
  );
}


function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-neutral-300 pb-2">
      <h2 className="text-sm font-extrabold uppercase tracking-[0.24em] text-neutral-900">
        {title}
      </h2>
      <span className="text-[0.55rem] font-bold uppercase tracking-[0.32em] text-neutral-400">
        {subtitle}
      </span>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "ok" | "warn" | "alert";
}) {
  const border =
    tone === "alert"
      ? "border-red-600"
      : tone === "warn"
        ? "border-amber-500"
        : "border-neutral-900";
  const valueColor =
    tone === "alert"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-neutral-900";
  return (
    <div
      className={`rounded-lg border-2 ${border} bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]`}
    >
      <div className="flex items-center gap-2 text-neutral-500">
        <span className="grid h-6 w-6 place-items-center rounded-sm border border-neutral-300 bg-neutral-50">
          {icon}
        </span>
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em]">
          {label}
        </span>
      </div>
      <p
        className={`mt-3 text-4xl font-black ${valueColor}`}
        style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function ProjectCard({ p }: { p: any }) {
  const hasCrew = p.active_crews > 0;
  const overtime = p.overtime > 0;
  const permits = p.pending_permits > 0;
  return (
    <div className="flex h-full flex-col rounded-lg border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-neutral-900">{p.name}</h3>
          {p.site_address && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">{p.site_address}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-sm px-2 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest ${
            hasCrew
              ? "border border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border border-neutral-300 bg-neutral-50 text-neutral-500"
          }`}
        >
          {hasCrew ? "Live" : "Idle"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MicroStat icon={<Users size={12} />} label="On Site" value={p.manpower} />
        <MicroStat icon={<Activity size={12} />} label="Active Crews" value={p.active_crews} />
        <MicroStat
          icon={<ShieldAlert size={12} />}
          label="Open Permits"
          value={p.open_permits}
          tone={permits ? "warn" : "ok"}
        />
        <MicroStat
          icon={<AlertTriangle size={12} />}
          label="Overtime"
          value={p.overtime}
          tone={overtime ? "alert" : "ok"}
        />
      </div>

      <Link
        to="/site-manager/$projectId"
        params={{ projectId: p.id }}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border-2 border-[#1d3f8a] bg-[#1d3f8a] px-4 py-2.5 text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-white shadow-[3px_3px_0_0_rgba(15,23,42,0.25)] transition hover:brightness-110"
      >
        Enter Command Tower <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function MicroStat({
  icon,
  label,
  value,
  tone = "ok",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "ok" | "warn" | "alert";
}) {
  const color =
    tone === "alert"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-neutral-900";
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-widest text-neutral-500">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}

function AlertRow({ a }: { a: any }) {
  const palette =
    a.kind === "overtime"
      ? { border: "border-l-red-500", chip: "bg-red-50 text-red-700 border-red-200" }
      : a.kind === "permit"
        ? { border: "border-l-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200" }
        : { border: "border-l-orange-500", chip: "bg-orange-50 text-orange-700 border-orange-200" };
  return (
    <li className={`border-l-4 ${palette.border} px-4 py-3`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-sm border px-1.5 py-0.5 font-mono text-[0.5rem] font-bold uppercase tracking-widest ${palette.chip}`}
        >
          {a.kind.replace("_", " ")}
        </span>
        <span className="text-[0.55rem] uppercase tracking-widest text-neutral-400">
          {new Date(a.at).toLocaleTimeString()}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-neutral-900">
        <Link
          to="/site-manager/$projectId"
          params={{ projectId: a.project_id }}
          className="hover:underline"
        >
          {a.project_name}
        </Link>
      </p>
      <p className="text-xs text-neutral-600">{a.label}</p>
    </li>
  );
}
