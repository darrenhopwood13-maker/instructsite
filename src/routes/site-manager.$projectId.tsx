import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, Clock, Users, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getProject } from "@/lib/projects.functions";
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
  const drawingsFn = useServerFn(listProjectDrawings);
  const pinsFn = useServerFn(listLivePins);
  const closeFn = useServerFn(closeLivePin);
  const archivedFn = useServerFn(listArchivedToday);

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

  const drawingRows = useMemo(() => drawings.data ?? [], [drawings.data]);
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedDrawing && drawingRows.length) setSelectedDrawing(drawingRows[0].id);
  }, [drawingRows, selectedDrawing]);

  const pins = useQuery({
    queryKey: ["live-pins", projectId, selectedDrawing],
    queryFn: () =>
      pinsFn({ data: { projectId, drawingId: selectedDrawing!, activeOnly: true } }),
    enabled: ready && !!selectedDrawing,
    refetchInterval: 8000,
  });

  const archivedToday = useQuery({
    queryKey: ["archived-today", projectId],
    queryFn: () => archivedFn({ data: { projectId } }),
    enabled: ready,
    refetchInterval: 30000,
  });

  // Realtime — reactivate on any change
  useEffect(() => {
    if (!ready) return;
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
  }, [projectId, ready, qc]);

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

  const closePin = async (pinId: string) => {
    await closeFn({ data: { pinId } });
    setActivePin(null);
    qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
  };

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

        <section className="mt-10">
          <ClientOnly fallback={<div className="glass-panel h-[560px] animate-pulse" />}>
            <BimModelViewer projectId={projectId} />
          </ClientOnly>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <BimModelUploader projectId={projectId} />
          <BimMappingEditor projectId={projectId} />
        </section>


        <section className="mt-10">
          <QsVerificationQueue projectId={projectId} />
        </section>

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
        <div className="fixed bottom-6 right-6 z-40 w-80 rounded-lg border-2 border-alert bg-black/90 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
                Crew HUD
              </p>
              <h4 className="mt-0.5 truncate text-base font-extrabold text-foreground">
                {activePin.trade_package ?? "Untagged Crew"}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setActivePin(null)}
              className="rounded-sm border border-white/15 p-1 text-foreground/60 hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-foreground/80">
            <p className="flex items-center gap-1.5">
              <Users size={12} className="text-alert" /> {activePin.operative_count} operatives
            </p>
            <p className="flex items-center gap-1.5">
              <Clock size={12} className="text-alert" />
              Elapsed{" "}
              {activePin.start_time
                ? formatDuration(now - new Date(activePin.start_time).getTime())
                : "—"}
            </p>
            <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
              Zone: {activePin.work_zones?.name ?? "—"}
              {activePin.work_zones?.level ? ` · ${activePin.work_zones.level}` : ""}
            </p>
            <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
              Scheduled finish {activePin.scheduled_finish ? new Date(activePin.scheduled_finish).toLocaleString() : "—"}
            </p>
            {activePin.scheduled_finish &&
              new Date(activePin.scheduled_finish).getTime() < now && (
                <p className="mt-2 rounded-sm border border-red-500 bg-red-600/20 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-red-400">
                  Overtime · resource delay
                </p>
              )}
          </div>
          {activePin.permit_required && activePin.permit_status !== "active" && (
            <div className="mt-3 rounded-md border-2 border-amber-400 bg-amber-400/10 p-2.5">
              <p className="flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-amber-300">
                <ShieldAlert size={12} /> Permit Required
              </p>
              {activePin.high_risk_flags && activePin.high_risk_flags.length > 0 && (
                <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-amber-200/80">
                  {activePin.high_risk_flags.map((f) => f.replace(/_/g, " ")).join(" · ")}
                </p>
              )}
              <button
                type="button"
                onClick={() => setPermitPin(activePin)}
                className="mt-2 w-full rounded-md bg-amber-400 px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-widest text-black shadow hover:bg-amber-300"
              >
                Review & Issue Permit to Work
              </button>
            </div>
          )}
          {activePin.permit_status === "active" && (
            <p className="mt-3 rounded-sm border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-center font-mono text-[0.6rem] font-bold uppercase tracking-widest text-emerald-400">
              Permit Active
            </p>
          )}
          <button
            type="button"
            onClick={() => closePin(activePin.id)}
            className="mt-3 w-full rounded-md border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert"
          >
            Clear Crew Out
          </button>
        </div>
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
