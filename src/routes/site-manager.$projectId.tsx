import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, Clock, Users, X, ShieldAlert, ClipboardList, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import { listProjectDrawings } from "@/lib/tier1-uploads.functions";
import { listLivePins, closeLivePin } from "@/lib/live-activity.functions";
import { listArchivedToday } from "@/lib/daily-diary.functions";
import { DrawingCanvas, type PinRecord } from "@/components/project/DrawingCanvas";
import { QsVerificationQueue } from "@/components/project/QsVerificationQueue";
import { BimModelViewer } from "@/components/project/BimModelViewer";
import { BimModelUploader } from "@/components/project/BimModelUploader";
import { BimMappingEditor } from "@/components/project/BimMappingEditor";
import { PermitSignOffModal } from "@/components/project/PermitSignOffModal";
import { ForceCheckoutModal } from "@/components/project/ForceCheckoutModal";
import { ClientOnly } from "@tanstack/react-router";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";



import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/site-manager/$projectId")({
  head: () => ({ meta: [{ title: "Site Manager · Command Tower" }] }),
  component: SiteManagerPage,
});

function formatDuration(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function SiteManagerPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const qc = useQueryClient();
  const getP = useServerFn(getProject);
  const rolesFn = useServerFn(getMyRoles);
  const drawingsFn = useServerFn(listProjectDrawings);
  const pinsFn = useServerFn(listLivePins);
  const closeFn = useServerFn(closeLivePin);
  const archivedFn = useServerFn(listArchivedToday);

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const roles = rolesQ.data?.roles ?? [];
  const isMainContractor =
    roles.includes("master_admin") ||
    roles.includes("project_admin") ||
    roles.includes("site_manager");
  const roleGateReady = ready && !rolesQ.isLoading;
  const allowLoad = roleGateReady && isMainContractor;

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: allowLoad,
  });
  const drawings = useQuery({
    queryKey: ["drawings", projectId],
    queryFn: () => drawingsFn({ data: { projectId } }),
    enabled: allowLoad,
  });

  const drawingRows = useMemo(() => drawings.data ?? [], [drawings.data]);
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedDrawing && drawingRows.length) setSelectedDrawing(drawingRows[0].id);
  }, [drawingRows, selectedDrawing]);

  const pins = useQuery({
    queryKey: ["live-pins", projectId, selectedDrawing],
    queryFn: () =>
      pinsFn({ data: { projectId, drawingId: selectedDrawing!, activeOnly: true } }),
    enabled: allowLoad && !!selectedDrawing,
    refetchInterval: 8000,
  });

  const archivedToday = useQuery({
    queryKey: ["archived-today", projectId],
    queryFn: () => archivedFn({ data: { projectId } }),
    enabled: allowLoad,
    refetchInterval: 30000,
  });

  // Realtime — reactivate on any change
  useEffect(() => {
    if (!allowLoad) return;
    const ch = supabase
      .channel(`live-activity-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_site_activity", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["live-pins", projectId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_site_diaries", filter: `project_id=eq.${projectId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["qs-queue", projectId] });
          qc.invalidateQueries({ queryKey: ["archived-today", projectId] });
          qc.invalidateQueries({ queryKey: ["zone-completion", projectId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, allowLoad, qc]);

  // 1s tick to update elapsed timers + overtime detection
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const overtime = (pins.data ?? []).filter(
    (p: any) => new Date(p.scheduled_finish).getTime() < now,
  );

  // Toast overtime once per pin
  useEffect(() => {
    overtime.forEach((p: any) => {
      const key = `overtime:${p.id}:${p.scheduled_finish}`;
      if (typeof window === "undefined") return;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
      toast.error(`Overtime · ${p.trade_package ?? "Crew"} still on site`, {
        description: `${p.operative_count} operative(s) past scheduled finish.`,
      });
    });
  }, [overtime]);

  const [activePin, setActivePin] = useState<PinRecord | null>(null);
  const [permitPin, setPermitPin] = useState<PinRecord | null>(null);
  const [forcePin, setForcePin] = useState<PinRecord | null>(null);
  const [bimOpen, setBimOpen] = useState(false);
  const [qsOpen, setQsOpen] = useState(true);

  const closePin = async (pinId: string) => {
    await closeFn({ data: { pinId } });
    setActivePin(null);
    qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
  };

  if (roleGateReady && !isMainContractor) {
    return (
      <AccessDeniedScreen message="The Site Manager Command Tower is restricted to the main contractor's site management team." />
    );
  }
  if (project.isError) {
    return <AccessDeniedScreen message={(project.error as Error)?.message} />;
  }

  return (

    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />

      {overtime.length > 0 && (
        <div className="sticky top-16 z-40 border-y-2 border-red-500 bg-red-600/90 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-white shadow-lg backdrop-blur">
          <AlertTriangle className="mr-2 inline" size={16} />
          Overtime / Resource Delay Alert — {overtime.length} crew{overtime.length > 1 ? "s" : ""} past scheduled finish
        </div>
      )}

      <div className="relative mx-auto max-w-6xl px-6 py-10">
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
          Command Tower · Live
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          Realtime spatial overlay of active site labor · click any pin for the HUD popover.
        </p>

        <div className="mt-4">
          <Link
            to="/subcontractor-pack/$projectId/manager"
            params={{ projectId }}
            className="inline-flex items-center gap-2 rounded-md border-2 border-alert bg-alert/10 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-alert hover:bg-alert hover:text-black transition-colors"
          >
            <ClipboardList size={14} /> Subcontractors Weekly Pack
          </Link>
        </div>


        <section className="mt-6">
          <DrawingCanvas
            drawings={drawingRows as never}
            selectedId={selectedDrawing}
            onSelect={setSelectedDrawing}
            onLockOracle={() => {}}
            pins={(pins.data ?? []) as never}
            pinMode="view"
            onPinClick={(p) => setActivePin(p)}
            activePinId={activePin?.id ?? null}
          />
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Pins" value={String((pins.data ?? []).length)} />
          <StatCard
            label="Operatives On Site"
            value={String(
              (pins.data ?? []).reduce((s: number, p: any) => s + (p.operative_count ?? 0), 0),
            )}
          />
          <StatCard label="Overtime" value={String(overtime.length)} tone={overtime.length ? "alert" : "ok"} />
          <StatCard label="Archived Today" value={String(archivedToday.data?.count ?? 0)} />
        </section>

        <CollapsibleSection
          label="BIM / IFC Model"
          description="View, upload, and map IFC models to project zones"
          open={bimOpen}
          onToggle={() => setBimOpen(!bimOpen)}
        >
          <ClientOnly fallback={<div className="glass-panel h-[560px] animate-pulse" />}>
            <BimModelViewer projectId={projectId} />
          </ClientOnly>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <BimModelUploader projectId={projectId} />
            <BimMappingEditor projectId={projectId} />
          </div>
        </CollapsibleSection>


        <CollapsibleSection
          label="QS Verification Queue"
          description="Verified quantities, diary reconciliation, and sign-off requests"
          open={qsOpen}
          onToggle={() => setQsOpen(!qsOpen)}
        >
          <QsVerificationQueue projectId={projectId} />
        </CollapsibleSection>

        <section className="mt-8">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
            Active Crews (All Sheets)
          </h2>
          <ul className="mt-3 space-y-2">
            {(pins.data ?? []).map((p: any) => {
              const isOT = new Date(p.scheduled_finish).getTime() < now;
              return (
                <li
                  key={p.id}
                  className={`glass-panel flex items-center justify-between gap-3 p-3 ${isOT ? "border-red-500" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {p.trade_package ?? "Untagged"} · {p.operative_count} ops
                    </p>
                    <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                      Started {new Date(p.start_time).toLocaleTimeString()} · finish{" "}
                      {new Date(p.scheduled_finish).toLocaleTimeString()}
                    </p>
                  </div>
                  {isOT && (
                    <span className="rounded-sm bg-red-600 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-white">
                      Overtime
                    </span>
                  )}
                </li>
              );
            })}
            {(pins.data ?? []).length === 0 && (
              <li className="glass-panel p-4 text-center text-xs text-foreground/50">
                No active labor pins.
              </li>
            )}
          </ul>
        </section>
      </div>

      {activePin && (
        <PinInfoModal
          pinId={activePin.id}
          onClose={() => setActivePin(null)}
          actions={
            <div className="space-y-2">
              {activePin.permit_required && activePin.permit_status !== "active" && (
                <button
                  type="button"
                  onClick={() => setPermitPin(activePin)}
                  className="w-full rounded-md bg-amber-400 px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-widest text-black shadow hover:bg-amber-300"
                >
                  Review & Issue Permit to Work
                </button>
              )}
              <button
                type="button"
                onClick={() => setForcePin(activePin)}
                className="w-full rounded-md border-2 border-alert bg-alert/10 px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-widest text-alert shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] hover:bg-alert hover:text-black"
              >
                Force Checkout & Close Daily Diary
              </button>
              <button
                type="button"
                onClick={() => closePin(activePin.id)}
                className="w-full rounded-md border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert"
              >
                Clear Crew Out
              </button>
            </div>
          }
        />
      )}

      {permitPin && (
        <PermitSignOffModal
          pin={permitPin}
          projectId={projectId}
          onClose={() => {
            setPermitPin(null);
            qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
          }}
        />
      )}

      {forcePin && (
        <ForceCheckoutModal
          pin={forcePin}
          onClose={() => setForcePin(null)}
          onDone={() => {
            setForcePin(null);
            setActivePin(null);
            qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
            qc.invalidateQueries({ queryKey: ["archived-today", projectId] });
          }}
        />
      )}

    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "alert";
}) {
  return (
    <div
      className={`glass-panel p-4 ${tone === "alert" ? "border-red-500" : ""}`}
    >
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-extrabold ${tone === "alert" ? "text-red-400" : "text-foreground"}`}
        style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function CollapsibleSection({
  label,
  description,
  open,
  onToggle,
  children,
}: {
  label: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-5 py-4 text-left transition hover:bg-black/50"
      >
        <div className="min-w-0">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
            {label}
          </h2>
          <p className="mt-0.5 text-[0.6rem] text-foreground/50">
            {description}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-foreground/50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="mt-6">{children}</div>}
    </section>
  );
}
