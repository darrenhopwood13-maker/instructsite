import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Cloud,
  Clock,
  Users,
  MapPin,
  ImageIcon,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import { listMyDiaryFeed } from "@/lib/my-diary.functions";
import { getProjectWeather } from "@/lib/weather.functions";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/my-diary/$projectId")({
  head: () => ({ meta: [{ title: "My Site Diary — instructSite" }] }),
  component: MyDiaryPage,
});

type LivePin = {
  id: string;
  zone_id: string | null;
  workface_id: string | null;
  drawing_id: string | null;
  trade_package: string | null;
  operative_count: number | null;
  start_time: string;
  scheduled_finish: string;
  notes: string | null;
  permit_status: string | null;
  high_risk_flags: string[] | null;
  work_zones?: { name?: string | null; level?: string | null } | null;
};

type DiaryEntry = {
  id: string;
  zone_id: string | null;
  workface_id: string | null;
  trade_package: string | null;
  operative_count: number | null;
  hours_logged: number | null;
  progress_status: string | null;
  completion_pct: number | null;
  notes: string | null;
  photo_urls: string[] | null;
  qs_status: string | null;
  checkout_time: string;
  work_zones?: { name?: string | null; level?: string | null } | null;
};

type Workface = {
  id: string;
  name: string;
  stage: string | null;
  zone_id: string | null;
  package_invite_id: string | null;
  status: string;
};

function MyDiaryPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const getP = useServerFn(getProject);
  const rolesFn = useServerFn(getMyRoles);
  const feedFn = useServerFn(listMyDiaryFeed);
  const weatherFn = useServerFn(getProjectWeather);

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const roles = rolesQ.data?.roles ?? [];
  const isSiteManager =
    roles.includes("master_admin") ||
    roles.includes("project_admin") ||
    roles.includes("site_manager");
  const roleGateReady = ready && !rolesQ.isLoading;

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready && isSiteManager,
  });

  const feed = useQuery({
    queryKey: ["my-diary-feed", projectId],
    queryFn: () => feedFn({ data: { projectId } }),
    enabled: ready && isSiteManager,
    refetchInterval: 60_000,
  });

  const weather = useQuery({
    queryKey: ["weather", projectId],
    queryFn: () => weatherFn({ data: { projectId } }),
    enabled: ready && isSiteManager,
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const livePins = useMemo(() => (feed.data?.livePins ?? []) as LivePin[], [feed.data]);
  const diaries = useMemo(() => (feed.data?.diaries ?? []) as DiaryEntry[], [feed.data]);
  const workfaces = useMemo(() => (feed.data?.workfaces ?? []) as Workface[], [feed.data]);
  const packages = feed.data?.packages ?? [];

  // Group everything by workspace/zone name — total operatives per zone,
  // each activity shown as its own bordered card, matching the app's
  // existing card conventions elsewhere.
  const zoneGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; livePins: LivePin[]; diaries: DiaryEntry[]; operatives: number }
    >();
    const keyFor = (z?: { name?: string | null; level?: string | null } | null) =>
      z?.name ? `${z.level ? `L${z.level} — ` : ""}${z.name}` : "Unassigned Zone";

    for (const p of livePins) {
      const label = keyFor(p.work_zones);
      if (!groups.has(label))
        groups.set(label, { label, livePins: [], diaries: [], operatives: 0 });
      const g = groups.get(label)!;
      g.livePins.push(p);
      g.operatives += p.operative_count ?? 0;
    }
    for (const d of diaries) {
      const label = keyFor(d.work_zones);
      if (!groups.has(label))
        groups.set(label, { label, livePins: [], diaries: [], operatives: 0 });
      groups.get(label)!.diaries.push(d);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [livePins, diaries]);

  if (!roleGateReady) {
    return <div className="min-h-[calc(100vh-4rem)] bg-background" />;
  }
  if (!isSiteManager) {
    return <AccessDeniedScreen message="My Diary is only available to Site Managers." />;
  }

  const workfaceName = (id: string | null) =>
    id ? (workfaces.find((w) => w.id === id)?.name ?? null) : null;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-5xl px-4 py-8 md:px-6">
        <Link
          to="/site-manager/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> Command Tower
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              My Site Diary
            </p>
            <h1
              className="mt-1 break-words text-3xl font-extrabold uppercase leading-tight tracking-tight text-foreground md:text-4xl"
              style={{ fontFamily: "'Michroma', 'Inter Tight', sans-serif" }}
            >
              {project.data?.name ?? "Loading…"}
            </h1>
            <p className="mt-1.5 text-xs text-foreground/60">
              {packages.length > 0
                ? `Showing ${packages.length} assigned package${packages.length === 1 ? "" : "s"}: ${packages
                    .map((p: { company_name: string }) => p.company_name)
                    .join(", ")}`
                : "No packages assigned to you on this project yet — ask a Project Admin to assign you as Package Manager in the Trade Directory."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-foreground/80">
              <Clock size={13} />
              <span className="font-mono text-xs">
                {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-1.5 text-foreground/80">
              <Cloud size={13} />
              <span className="font-mono text-xs">
                {weather.data
                  ? `${Math.round(weather.data.temperature_c ?? 0)}°C · ${weather.data.summary}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {zoneGroups.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-white/15 bg-black/25 p-10 text-center text-sm text-foreground/50">
            No planned or completed activity yet from your assigned packages.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {zoneGroups.map((g) => (
              <div key={g.label} className="glass-panel p-5">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-alert" />
                    <h2 className="text-sm font-extrabold uppercase tracking-widest text-foreground">
                      {g.label}
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/60">
                    <Users size={12} /> {g.operatives} operative{g.operatives === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {g.livePins.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border border-amber-400/40 bg-amber-400/5 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">
                          {p.trade_package ?? "Trade TBC"} · Planned
                        </p>
                        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                          {new Date(p.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          →{" "}
                          {new Date(p.scheduled_finish).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {workfaceName(p.workface_id) && (
                        <p className="mt-1 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                          <Layers size={10} /> {workfaceName(p.workface_id)}
                        </p>
                      )}
                      {p.notes && <p className="mt-1.5 text-xs text-foreground/70">{p.notes}</p>}
                      {p.permit_status === "required" && (
                        <p className="mt-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-destructive-foreground">
                          ⚠ Permit Required
                        </p>
                      )}
                      {p.drawing_id && (
                        <Link
                          to="/site-manager/$projectId"
                          params={{ projectId }}
                          search={{ locatePinId: p.id, locateDrawingId: p.drawing_id }}
                          className="mt-2 inline-flex items-center gap-1 rounded-sm border border-amber-400/50 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-amber-300 hover:bg-amber-400/10"
                        >
                          <MapPin size={10} /> Locate on Command Tower
                        </Link>
                      )}
                    </div>
                  ))}

                  {g.diaries.map((d) => (
                    <div key={d.id} className="rounded-md border border-white/10 bg-black/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs font-bold uppercase tracking-widest text-foreground/85">
                          {d.trade_package ?? "Trade TBC"} · {d.progress_status ?? "—"}
                        </p>
                        <span
                          className={`rounded-sm border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                            d.qs_status === "approved"
                              ? "border-emerald-400/50 text-emerald-300"
                              : d.qs_status === "rejected"
                                ? "border-destructive/60 text-destructive-foreground"
                                : "border-alert/60 text-alert"
                          }`}
                        >
                          {d.qs_status === "approved" && (
                            <CheckCircle2 size={9} className="mr-1 inline" />
                          )}
                          {d.qs_status ?? "pending"}
                        </span>
                      </div>
                      {workfaceName(d.workface_id) && (
                        <p className="mt-1 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                          <Layers size={10} /> {workfaceName(d.workface_id)}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                        <span>{d.completion_pct ?? 0}% complete</span>
                        <span>{d.hours_logged ?? 0}h logged</span>
                        {(d.photo_urls ?? []).length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon size={10} /> {d.photo_urls!.length}
                          </span>
                        )}
                      </div>
                      {d.notes && <p className="mt-1.5 text-xs text-foreground/70">{d.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
