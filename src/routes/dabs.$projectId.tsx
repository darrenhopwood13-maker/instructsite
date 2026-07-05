import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, LogOut, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { getProject } from "@/lib/projects.functions";
import { listProjectDrawings, listProjectZones } from "@/lib/tier1-uploads.functions";
import { createLivePin, listLivePins, closeLivePin } from "@/lib/live-activity.functions";
import { DrawingCanvas } from "@/components/project/DrawingCanvas";
import { CheckoutDiaryModal } from "@/components/project/CheckoutDiaryModal";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";


export const Route = createFileRoute("/dabs/$projectId")({
  head: () => ({ meta: [{ title: "DABS — Spatial Labor Tracker" }] }),
  component: DabsPage,
});

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DabsPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const qc = useQueryClient();
  const getP = useServerFn(getProject);
  const drawingsFn = useServerFn(listProjectDrawings);
  const zonesFn = useServerFn(listProjectZones);
  const pinsFn = useServerFn(listLivePins);
  const createFn = useServerFn(createLivePin);
  const closeFn = useServerFn(closeLivePin);

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
  const zones = useQuery({
    queryKey: ["zones", projectId],
    queryFn: () => zonesFn({ data: { projectId } }),
    enabled: ready,
  });

  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string>("");
  const [trade, setTrade] = useState<string>("");

  const drawingRows = useMemo(() => drawings.data ?? [], [drawings.data]);
  useEffect(() => {
    if (!selectedDrawing && drawingRows.length) setSelectedDrawing(drawingRows[0].id);
  }, [drawingRows, selectedDrawing]);

  const pins = useQuery({
    queryKey: ["live-pins", projectId, selectedDrawing],
    queryFn: () => pinsFn({ data: { projectId, drawingId: selectedDrawing!, activeOnly: true } }),
    enabled: ready && !!selectedDrawing,
    refetchInterval: 6000,
  });

  const [pending, setPending] = useState<{ xPct: number; yPct: number } | null>(null);
  const [checkoutPin, setCheckoutPin] = useState<any | null>(null);
  const [operatives, setOperatives] = useState(1);
  const [startTime, setStartTime] = useState(() => toLocalInput(new Date()));
  const [finishTime, setFinishTime] = useState(() =>
    toLocalInput(new Date(Date.now() + 8 * 3600 * 1000)),
  );
  const [busy, setBusy] = useState(false);

  const handleDrop = (coords: { xPct: number; yPct: number }) => {
    if (!selectedDrawing) {
      toast.error("Select a drawing first.");
      return;
    }
    setPending(coords);
  };

  const closePin = async (pinId: string) => {
    await closeFn({ data: { pinId } });
    qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || !selectedDrawing) return;
    setBusy(true);
    try {
      await createFn({
        data: {
          projectId,
          drawingId: selectedDrawing,
          zoneId: zoneId || undefined,
          tradePackage: trade || undefined,
          operativeCount: operatives,
          startTime: new Date(startTime).toISOString(),
          scheduledFinish: new Date(finishTime).toISOString(),
          xPct: pending.xPct,
          yPct: pending.yPct,
        },
      });
      toast.success("Pin dropped · briefing logged.");
      setPending(null);
      qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save pin.");
    } finally {
      setBusy(false);
    }
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
          DABS · Spatial Pin Drop
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          Select your zone & trade, then click the drawing to drop a labor pin.
        </p>

        <div className="glass-panel mt-6 grid gap-4 p-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Work Zone / Level
            </span>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
            >
              <option value="">— Select zone —</option>
              {zones.data?.map((z: any) => (
                <option key={z.id} value={z.id} disabled={z.status === "closed"}>
                  {z.name}
                  {z.level ? ` · ${z.level}` : ""}
                  {z.status === "closed" ? " — CLOSED" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Trade Package
            </span>
            <input
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              placeholder="e.g. Electrical First Fix"
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
            />
          </label>
        </div>

        <section className="mt-6">
          <DrawingCanvas
            drawings={drawingRows as never}
            selectedId={selectedDrawing}
            onSelect={setSelectedDrawing}
            onLockOracle={() => {}}
            pins={(pins.data ?? []) as never}
            pinMode="drop"
            onDropPin={handleDrop}
            onPinClick={(pin) => {
              const dur = Math.round(
                (Date.now() - new Date(pin.start_time ?? pin.scheduled_finish!).getTime()) / 60000,
              );
              toast(`${pin.trade_package ?? "Pin"} · ${pin.operative_count} ops · ${dur} min`, {
                action: {
                  label: "Close",
                  onClick: () => closePin(pin.id),
                },
              });
            }}
          />
        </section>

        <section className="mt-6">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
            Active Shifts on This Sheet
          </h2>
          <ul className="mt-3 space-y-3">
            {(pins.data ?? []).map((p: any) => (
              <li key={p.id} className="glass-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {p.trade_package ?? "Untagged"} · {p.operative_count} operatives
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                      <MapPin size={10} /> {p.work_zones?.name ?? "no zone"} · started{" "}
                      {new Date(p.start_time).toLocaleTimeString()} · finish{" "}
                      {new Date(p.scheduled_finish).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => closePin(p.id)}
                    className="rounded-sm border border-white/15 px-2 py-1 text-[0.55rem] uppercase tracking-widest text-foreground/50 hover:border-red-500 hover:text-red-400"
                    title="Discard pin without diary (admin)"
                  >
                    Discard
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutPin(p)}
                  className="glass-orange shimmer-btn mt-3 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-xs font-bold uppercase tracking-widest"
                >
                  <LogOut size={14} /> Close Out Today's Shift / Complete Daily Diary
                </button>
              </li>
            ))}
            {(pins.data ?? []).length === 0 && (
              <li className="glass-panel p-4 text-center text-xs text-foreground/50">
                No active shifts on this sheet.
              </li>
            )}
          </ul>
        </section>

        <section className="mt-10">
          <Link
            to="/site-manager/$projectId"
            params={{ projectId }}
            className="glass-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider"
          >
            <ClipboardList size={14} /> Site Manager Command Tower
          </Link>
        </section>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <form
            onSubmit={submit}
            className="glass-panel w-full max-w-md border-2 border-alert p-6"
          >
            <div className="flex items-center justify-between">
              <h3
                className="text-xl font-extrabold uppercase tracking-wider text-alert"
                style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
              >
                Labor Briefing
              </h3>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-sm border border-white/15 p-1.5 text-foreground/60 hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
              Pin @ {(pending.xPct * 100).toFixed(1)}%, {(pending.yPct * 100).toFixed(1)}%
            </p>

            <label className="mt-4 block">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                Operatives / Labor Count
              </span>
              <input
                type="number"
                min={1}
                required
                value={operatives}
                onChange={(e) => setOperatives(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                  Start
                </span>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-xs text-foreground outline-none focus:border-alert"
                />
              </label>
              <label className="block">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                  Scheduled Finish
                </span>
                <input
                  type="datetime-local"
                  required
                  value={finishTime}
                  onChange={(e) => setFinishTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-xs text-foreground outline-none focus:border-alert"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-md border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="glass-orange shimmer-btn rounded-md px-5 py-2 text-xs uppercase tracking-widest disabled:opacity-40"
              >
                {busy ? "Saving…" : "Confirm Briefing"}
              </button>
            </div>
          </form>
        </div>
      )}

      {checkoutPin && (
        <CheckoutDiaryModal
          pin={{
            id: checkoutPin.id,
            project_id: projectId,
            trade_package: checkoutPin.trade_package,
            operative_count: checkoutPin.operative_count,
            start_time: checkoutPin.start_time,
          }}
          onClose={() => setCheckoutPin(null)}
        />
      )}
    </div>
  );
}
