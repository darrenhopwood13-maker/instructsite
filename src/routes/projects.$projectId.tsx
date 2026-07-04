import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, ArrowLeft, ClipboardList, ShieldAlert } from "lucide-react";
import {
  getProject,
} from "@/lib/projects.functions";
import {
  listProjectDrawings,
  listProjectLogistics,
  listProjectRams,
} from "@/lib/tier1-uploads.functions";
import { DropZone } from "@/components/setup/DropZone";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project — Site Operations Oracle" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const getP = useServerFn(getProject);
  const drawingsFn = useServerFn(listProjectDrawings);
  const logisticsFn = useServerFn(listProjectLogistics);
  const ramsFn = useServerFn(listProjectRams);

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

  const refresh = () => {
    drawings.refetch();
    logistics.refetch();
    rams.refetch();
  };

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
              to="/site-manager/$projectId"
              params={{ projectId }}
              className="glass-orange inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider"
            >
              <ShieldAlert size={14} /> Site Manager
            </Link>
          </div>
        </div>

        {project.data?.scope_brief && (
          <p className="glass-panel mt-6 p-4 text-sm text-foreground/80">
            {project.data.scope_brief}
          </p>
        )}

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

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
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
            <RamsUploader projectId={projectId} onUploaded={refresh} />
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <ListPanel title="Active Project Drawings" count={drawings.data?.length ?? 0}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[0.65rem] uppercase tracking-widest text-foreground/50">
                  <th className="py-2">Dwg No</th>
                  <th>Rev</th>
                  <th>Title</th>
                  <th>Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-foreground/85">
                {drawings.data?.map((d: any) => (
                  <tr key={d.id} className="border-t border-white/8">
                    <td className="py-2">{d.drawing_no ?? "—"}</td>
                    <td>{d.revision ?? "—"}</td>
                    <td className="max-w-[10rem] truncate">
                      {d.title ?? d.site_documents?.file_name}
                    </td>
                    <td>{d.level ?? "—"}</td>
                    <td>
                      <StatusPill status={d.extraction_status} />
                    </td>
                  </tr>
                ))}
                {drawings.data && drawings.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-foreground/50">
                      No drawings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ListPanel>

          <ListPanel title="Logistics Zones" count={logistics.data?.length ?? 0}>
            {logistics.data?.map((l: any) => (
              <div key={l.id} className="border-t border-white/8 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-foreground/85">
                    {l.site_documents?.file_name}
                  </span>
                  <StatusPill status={l.extraction_status} />
                </div>
                {Array.isArray(l.extracted_zones) && l.extracted_zones.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.extracted_zones.slice(0, 12).map((z: any, i: number) => (
                      <span
                        key={i}
                        className="rounded-sm border border-alert/30 bg-alert/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-alert"
                      >
                        {z.name}
                        {z.level ? ` · ${z.level}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {logistics.data && logistics.data.length === 0 && (
              <p className="py-4 text-center text-xs text-foreground/50">No logistics plans.</p>
            )}
          </ListPanel>

          <ListPanel title="Master RAMS" count={rams.data?.length ?? 0}>
            {rams.data?.map((r: any) => (
              <div key={r.id} className="border-t border-white/8 py-2 text-xs">
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
                <div className="mt-1 text-[0.65rem] uppercase tracking-widest text-foreground/50">
                  Trade: {r.trade_package}
                </div>
                {r.high_risk_flags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.high_risk_flags.map((f: string) => (
                      <span
                        key={f}
                        className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-foreground/80"
                      >
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {rams.data && rams.data.length === 0 && (
              <p className="py-4 text-center text-xs text-foreground/50">No RAMS uploaded.</p>
            )}
          </ListPanel>
        </div>
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
    <div className="glass-panel p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          {title}
        </h3>
        <span className="font-mono text-[0.7rem] text-foreground/60">{count}</span>
      </div>
      <div className="max-h-96 overflow-y-auto">{children}</div>
    </div>
  );
}

function RamsUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const [trade, setTrade] = useState("General");
  const [flags, setFlags] = useState<string[]>([]);

  const toggle = (f: string) =>
    setFlags((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <div className="flex flex-col gap-3">
      <div className="glass-panel p-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-alert">
          RAMS Metadata
        </p>
        <label className="mt-2 block">
          <span className="text-[0.65rem] uppercase tracking-widest text-foreground/50">
            Trade Package
          </span>
          <input
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-foreground outline-none focus:border-alert"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["working_at_height", "hot_works", "confined_space"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              className={`rounded-sm border px-2 py-1 font-mono text-[0.65rem] uppercase tracking-widest ${
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
      <DropZone
        projectId={projectId}
        docType="rams"
        title="Master RAMS"
        subtitle="Risk Assessments & Method Statements per trade package."
        extraFields={{ tradePackage: trade, highRiskFlags: flags, permitRequired: flags.length > 0 }}
        onUploaded={onUploaded}
      />
    </div>
  );
}
