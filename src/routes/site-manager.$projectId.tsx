import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, ClipboardList, BookOpen, Box, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import { PageHeader } from "@/components/layout/PageHeader";
import { CollapsibleSection } from "@/components/layout/CollapsibleSection";
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
import { PinInfoModal } from "@/components/project/PinInfoModal";
import { pinColor, pinKey } from "@/lib/pin-color";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";



import { supabase } from "@/integrations/supabase/client";

const siteManagerSearchSchema = z.object({
  locatePinId: z.string().uuid().optional(),
  locateDrawingId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/site-manager/$projectId")({
  head: () => ({ meta: [{ title: "Site Manager · Command Tower" }] }),
  validateSearch: siteManagerSearchSchema,
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
  const search = Route.useSearch();
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  useEffect(() => {
    if (selectedDrawing) return;
    // A "Locate on Command Tower" link takes priority over the default
    // first-drawing selection, so arriving from My Diary lands on the
    // right sheet.
    if (search.locateDrawingId) {
      setSelectedDrawing(search.locateDrawingId);
    } else if (drawingRows.length) {
      setSelectedDrawing(drawingRows[0].id);
    }
  }, [drawingRows, selectedDrawing, search.locateDrawingId]);

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

  // "Locate on Command Tower" — once the pins for the located drawing
  // have loaded, auto-select the one the link pointed at and open its
  // info modal, same as if the manager had clicked it themselves.
  useEffect(() => {
    if (!search.locatePinId || !pins.data) return;
    const found = (pins.data as PinRecord[]).find((p) => p.id === search.locatePinId);
    if (found) setActivePin(found);
  }, [search.locatePinId, pins.data]);
  const [permitPin, setPermitPin] = useState<PinRecord | null>(null);
  const [forcePin, setForcePin] = useState<PinRecord | null>(null);

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

        <div className="mt-3">
          <PageHeader
            overline={project.data?.name ?? "Project"}
            title="Command Tower · Live"
            subtitle="Realtime spatial overlay of active site labor · click any pin for the HUD popover."
            LinkComponent={Link}
            actions={[
              {
                label: "Subcontractors Weekly Pack",
                icon: <ClipboardList size={15} />,
                to: "/subcontractor-pack/$projectId/manager",
                params: { projectId },
              },
            ]}
          />
        </div>

        {/* My Site Diary stays a directly visible button, not tucked in the
            Actions menu — it was hard to find when nested a level deeper,
            per earlier feedback, so it keeps its own prominent spot here. */}
        <div className="mt-4">
          <Link
            to="/my-diary/$projectId"
            params={{ projectId }}
            className="inline-flex items-center gap-2 rounded-md border-2 border-white/20 bg-black/40 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-foreground/80 hover:border-alert hover:text-alert transition-colors"
          >
            <BookOpen size={14} /> My Site Diary
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

        <div className="mt-10">
          <CollapsibleSection
            icon={<Box size={16} />}
            title="BIM / IFC Model"
            summary="View, upload, map to zones"
            defaultOpen={false}
          >
            <ClientOnly fallback={<div className="glass-panel h-[560px] animate-pulse" />}>
              <BimModelViewer projectId={projectId} />
            </ClientOnly>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <BimModelUploader projectId={projectId} />
              <BimMappingEditor projectId={projectId} />
            </div>
          </CollapsibleSection>
        </div>

        <div className="mt-6">
          <CollapsibleSection
            icon={<CheckCircle2 size={16} />}
            title="QS Verification Queue"
            summary="Verified quantities · sign-off"
            defaultOpen={true}
          >
            <QsVerificationQueue projectId={projectId} />
          </CollapsibleSection>
        </div>

        <section className="mt-8">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
            Active Crews (All Sheets)
          </h2>
          <ul className="mt-3 space-y-2">
            {(pins.data ?? []).map((p: any) => {
              const isOT = new Date(p.scheduled_finish).getTime() < now;
              const palette = pinColor(pinKey(p));
              return (
                <li
                  key={p.id}
                  className={`glass-panel flex items-center justify-between gap-3 border-l-4 p-3 ${isOT ? "border-red-500" : ""}`}
                  style={isOT ? undefined : { borderLeftColor: palette.hex }}
                >
                  <button
                    type="button"
                    onClick={() => setActivePin(p as PinRecord)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: palette.hex, boxShadow: `0 0 0 3px ${palette.ring}` }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <p className="text-sm text-foreground">
                        {p.trade_package ?? "Untagged"} · {p.operative_count} ops
                      </p>
                      <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                        Started {new Date(p.start_time).toLocaleTimeString()} · finish{" "}
                        {new Date(p.scheduled_finish).toLocaleTimeString()}
                      </p>
                    </span>
                  </button>
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
        style={{ fontFamily: "'Michroma', 'Inter Tight', sans-serif" }}
      >
        {value}
      </p>
    </div>
  );
}
