import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MapPin, ArrowLeft, ClipboardList, ShieldAlert, CalendarDays, Camera } from "lucide-react";
import { getProject } from "@/lib/projects.functions";
import {
  listProjectDrawings,
  listProjectLogistics,
  listProjectRams,
  listProjectZones,
} from "@/lib/tier1-uploads.functions";
import { DropZone } from "@/components/setup/DropZone";
import { DrawingCanvas } from "@/components/project/DrawingCanvas";
import { ZoneMap } from "@/components/project/ZoneMap";
import { MasterAdminHUD } from "@/components/admin/MasterAdminHUD";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { ZoneMatrixBoard } from "@/components/project/ZoneMatrixBoard";
import { TradeDirectoryPanel } from "@/components/admin/TradeDirectoryPanel";
import { WorkfaceRegisterPanel } from "@/components/admin/WorkfaceRegisterPanel";
import { getMyRoles } from "@/lib/projects.functions";
import { listSubcontractorInvites } from "@/lib/subcontractors.functions";
import { TRADE_PACKAGES } from "@/lib/trade-packages";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { hazardLabel } from "@/lib/high-risk";
import { countOpenSnagsForProject } from "@/lib/snags.functions";
import { rememberProject } from "@/lib/last-project";


export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project — instructSite" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  useEffect(() => {
    rememberProject(projectId);
  }, [projectId]);

  const getP = useServerFn(getProject);
  const openSnagsFn = useServerFn(countOpenSnagsForProject);
  const openSnags = useQuery({
    queryKey: ["open-snags", projectId],
    queryFn: () => openSnagsFn({ data: { projectId } }),
    enabled: ready,
  });
  const rolesFn = useServerFn(getMyRoles);
  const drawingsFn = useServerFn(listProjectDrawings);
  const logisticsFn = useServerFn(listProjectLogistics);
  const ramsFn = useServerFn(listProjectRams);
  const zonesFn = useServerFn(listProjectZones);

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const isAdmin =
    rolesQ.data?.roles?.includes("master_admin") ||
    rolesQ.data?.roles?.includes("project_admin");
  const isMainContractor =
    isAdmin || rolesQ.data?.roles?.includes("site_manager");


  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });
  const drawings = useQuery({
    queryKey: ["drawings", projectId],
    queryFn: () => drawingsFn({ data: { projectId } }),
    enabled: ready,
    refetchInterval: 5000,
  });
  const logistics = useQuery({
    queryKey: ["logistics", projectId],
    queryFn: () => logisticsFn({ data: { projectId } }),
    enabled: ready,
    refetchInterval: 5000,
  });
  const rams = useQuery({
    queryKey: ["rams", projectId],
    queryFn: () => ramsFn({ data: { projectId } }),
    enabled: ready,
    refetchInterval: 5000,
  });
  const zones = useQuery({
    queryKey: ["zones", projectId],
    queryFn: () => zonesFn({ data: { projectId } }),
    enabled: ready,
    refetchInterval: 5000,
  });

  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const drawingRows = useMemo(() => drawings.data ?? [], [drawings.data]);
  useEffect(() => {
    if (!selectedDrawing && drawingRows.length) setSelectedDrawing(drawingRows[0].id);
  }, [drawingRows, selectedDrawing]);

  const lockOracle = (payload: {
    kind: "drawing" | "zone";
    id: string;
    label: string;
  }) => {
    try {
      sessionStorage.setItem(
        "oracle:context",
        JSON.stringify({ ...payload, projectId, lockedAt: Date.now() }),
      );
    } catch {
      // ignore storage failures
    }
  };

  const refresh = () => {
    drawings.refetch();
    logistics.refetch();
    rams.refetch();
    zones.refetch();
  };

  if (project.isError) {
    return <AccessDeniedScreen message={(project.error as Error)?.message} />;
  }

  return (

    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> All Projects
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              Project
            </p>
            <h1
              className="mt-1 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {project.data?.name ?? "…"}
            </h1>
            {project.data?.site_address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-foreground/70">
                <MapPin size={14} /> {project.data.site_address}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Link
              to="/dabs/$projectId"
              params={{ projectId }}
              className="glass-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider"
            >
              <ClipboardList size={14} /> DABS
            </Link>
            <Link
              to="/snags"
              search={{ project: projectId }}
              className="glass-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider"
            >
              <Camera size={14} /> Open Snags
              <span className="rounded-full bg-alert/20 px-2 py-0.5 text-[0.65rem] text-alert">
                {openSnags.data?.count ?? 0}
              </span>
            </Link>
            <Link
              to="/programme/$projectId"
              params={{ projectId }}
              className="glass-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider"
            >
              <CalendarDays size={14} /> Randall Diary
            </Link>
            {isMainContractor && (
              <Link
                to="/site-manager/$projectId"
                params={{ projectId }}
                className="glass-orange inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider"
              >
                <ShieldAlert size={14} /> Site Manager
              </Link>
            )}
          </div>
        </div>

        {project.data?.scope_brief && (
          <p className="glass-panel mt-6 p-4 text-sm text-foreground/80">
            {project.data.scope_brief}
          </p>
        )}

        <MasterAdminHUD
          projectId={projectId}
          projectName={project.data?.name ?? ""}
          zones={(zones.data ?? []) as never}
          onZonesChanged={() => zones.refetch()}
        />

        {isAdmin && (
          <section className="mt-8">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              Project Administration
            </p>
            <h2
              className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Subcontractor & Trade Directory
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs text-foreground/60">
              Register trade companies, generate one-time secure invite tokens, and
              distribute QR codes for on-site onboarding.
            </p>
            <div className="mt-5">
              <TradeDirectoryPanel projectId={projectId} ready={ready} />
              <WorkfaceRegisterPanel projectId={projectId} />
            </div>
          </section>
        )}

        <ZoneMatrixBoard projectId={projectId} />






        {/* Upload engine row — symmetric 2-col */}
        <section className="mt-10">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            Tier-1 Operational Documents
          </p>
          <h2
            className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Upload Engine
          </h2>

          <div className="mt-5 grid auto-rows-fr gap-4 md:grid-cols-2">
            <DropZone
              projectId={projectId}
              docType="drawing"
              title="GA Drawings"
              subtitle="Title blocks auto-parsed → 'Active Project Drawings' dropdown."
              onUploaded={refresh}
            />
            <DropZone
              projectId={projectId}
              docType="logistics"
              title="Site Logistics"
              subtitle="Zones & levels extracted for spatial mapping."
              onUploaded={refresh}
            />
          </div>
        </section>

        {/* Drawing viewer — full width, tall */}
        <section className="mt-8">
          <DrawingCanvas
            drawings={(drawings.data ?? []) as never}
            selectedId={selectedDrawing}
            onSelect={setSelectedDrawing}
            onLockOracle={lockOracle}
          />
        </section>

        {/* Symmetric 2-col: Zones | unified RAMS Management */}
        <section className="mt-8 grid auto-rows-fr gap-6 lg:grid-cols-2">
          <div className="flex h-full flex-col">
            <ZoneMap
              zones={(zones.data ?? []) as never}
              selectedId={selectedZone}
              onSelect={setSelectedZone}
              onLockOracle={lockOracle}
            />
          </div>
          <div className="flex h-full flex-col">
            <UnifiedRamsBlock
              projectId={projectId}
              rams={rams.data ?? []}
              onUploaded={refresh}
            />
          </div>
        </section>

        {/* Logistics source docs */}
        <section className="mt-8">
          <ListPanel title="Logistics Source Plans" count={logistics.data?.length ?? 0}>
            {logistics.data?.map((l: any) => (
              <div key={l.id} className="border-t border-white/8 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="truncate font-mono text-foreground/85">
                    {l.site_documents?.file_name}
                  </span>
                  <StatusPill status={l.extraction_status} />
                </div>
                {Array.isArray(l.extracted_zones) && l.extracted_zones.length > 0 && (
                  <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {l.extracted_zones.length} zone{l.extracted_zones.length === 1 ? "" : "s"} extracted
                  </p>
                )}
              </div>
            ))}
            {logistics.data && logistics.data.length === 0 && (
              <p className="py-4 text-center text-xs text-foreground/50">No logistics plans.</p>
            )}
          </ListPanel>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-white/20 text-foreground/60",
    processing: "border-alert/50 text-alert",
    complete: "border-emerald-400/50 text-emerald-400",
    empty: "border-white/20 text-foreground/50",
    failed: "border-destructive/60 text-destructive-foreground",
  };
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}

function ListPanel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          {title}
        </h3>
        <span className="font-mono text-[0.7rem] text-foreground/60">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function UnifiedRamsBlock({
  projectId,
  rams,
  onUploaded,
}: {
  projectId: string;
  rams: any[];
  onUploaded: () => void;
}) {
  const [trade, setTrade] = useState<string>("");
  const [customTrade, setCustomTrade] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const invitesFn = useServerFn(listSubcontractorInvites);
  const invitesQ = useQuery({
    queryKey: ["rams-trade-invites", projectId],
    queryFn: () => invitesFn({ data: { projectId } }),
    staleTime: 60_000,
    retry: false,
  });

  const projectTrades = useMemo(() => {
    const set = new Set<string>();
    for (const inv of (invitesQ.data as any[]) ?? []) {
      for (const t of (inv.trade_packages ?? []) as string[]) if (t) set.add(t);
    }
    for (const r of rams ?? []) if (r?.trade_package) set.add(r.trade_package);
    return Array.from(set).sort();
  }, [invitesQ.data, rams]);

  const options = useMemo(() => {
    const set = new Set<string>([...projectTrades, ...TRADE_PACKAGES]);
    return Array.from(set);
  }, [projectTrades]);

  const isOther = trade === "__other__";
  const effectiveTrade = isOther ? customTrade.trim() : trade;
  const uniqueTrades = useMemo(
    () => new Set((rams ?? []).map((r: any) => r.trade_package).filter(Boolean)).size,
    [rams],
  );

  const toggle = (f: string) =>
    setFlags((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          RAMS Management
        </h3>
        <span className="font-mono text-[0.7rem] text-foreground/60">
          {rams.length} docs · {uniqueTrades} trades
        </span>
      </div>

      {/* Metadata + tags */}
      <div className="rounded-md border border-white/10 bg-black/40 p-3">
        <label className="block">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-foreground/60">
            Trade Package
          </span>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-sm text-foreground outline-none focus:border-alert"
          >
            <option value="">— Select trade package —</option>
            {projectTrades.length > 0 && (
              <optgroup label="On this project">
                {projectTrades.map((t) => (
                  <option key={`p-${t}`} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Standard trades">
              {options
                .filter((t) => !projectTrades.includes(t))
                .map((t) => (
                  <option key={`s-${t}`} value={t}>
                    {t}
                  </option>
                ))}
            </optgroup>
            <option value="__other__">Other…</option>
          </select>
        </label>
        {isOther && (
          <input
            value={customTrade}
            onChange={(e) => setCustomTrade(e.target.value)}
            placeholder="Type trade package"
            className="mt-2 w-full rounded-md border border-alert/50 bg-black/50 px-2 py-1.5 font-mono text-sm text-foreground outline-none focus:border-alert"
          />
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["working_at_height", "hot_works", "confined_space"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              className={`rounded-sm border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest ${
                flags.includes(f)
                  ? "border-alert bg-alert/20 text-alert"
                  : "border-white/15 text-foreground/60 hover:border-white/40"
              }`}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div className="mt-3">
        <DropZone
          projectId={projectId}
          docType="rams"
          title="Master RAMS Upload"
          subtitle="Risk Assessments & Method Statements per trade package."
          extraFields={{
            tradePackage: effectiveTrade,
            highRiskFlags: flags,
            permitRequired: flags.length > 0,
          }}
          disabledReason={!effectiveTrade ? "Choose a trade package first" : undefined}
          onUploaded={onUploaded}
        />
      </div>

      {/* Existing docs list */}
      <div className="mt-3 flex-1 overflow-y-auto rounded-md border border-white/10 bg-black/25 p-2">
        {rams.map((r: any) => (
          <div key={r.id} className="border-t border-white/8 py-2 text-xs first:border-t-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-foreground/85">
                {r.site_documents?.file_name}
              </span>
              {r.permit_required && (
                <span className="rounded-sm bg-alert px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-black">
                  Permit
                </span>
              )}
            </div>
            <div className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
              Trade: {r.trade_package}
            </div>
            {r.high_risk_flags?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.high_risk_flags.map((f: string) => (
                  <span
                    key={f}
                    className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-foreground/80"
                  >
                    {hazardLabel(f)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {rams.length === 0 && (
          <p className="py-4 text-center text-xs text-foreground/50">No RAMS uploaded.</p>
        )}
      </div>
    </div>
  );
}
