import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Send,
  X,
  Minus,
  Plus,
  ShieldAlert,
  Loader2,
  ClipboardList,
  LogOut,
  Layers,
  MapPin,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { getMyProjectContext } from "@/lib/subcontractors.functions";
import { listProjectDrawings, listProjectZones } from "@/lib/tier1-uploads.functions";
import { createLivePin, listLivePins } from "@/lib/live-activity.functions";
import { askProjectOracle } from "@/lib/oracle.functions";
import { DrawingCanvas } from "@/components/project/DrawingCanvas";
import { CheckoutDiaryModal } from "@/components/project/CheckoutDiaryModal";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";

export const Route = createFileRoute("/subcontractor/$projectId")({
  head: () => ({ meta: [{ title: "Subcontractor Cockpit — Site" }] }),
  component: SubcontractorCockpit,
});

const HIGH_RISK_RE =
  /(hot\s*work|welding|cutting torch|grinding|brazing|soldering|confined\s*space|manhole|work(ing)?\s*at\s*height|scaffold|roof|mewp|cherry\s*picker|ladder|excavation|dig(ging)?|trench|groundworks)/i;

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SubcontractorCockpit() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const ctxFn = useServerFn(getMyProjectContext);
  const drawingsFn = useServerFn(listProjectDrawings);
  const zonesFn = useServerFn(listProjectZones);
  const pinsFn = useServerFn(listLivePins);
  const createPinFn = useServerFn(createLivePin);
  const askFn = useServerFn(askProjectOracle);

  const ctx = useQuery({
    queryKey: ["subctx", projectId],
    queryFn: () => ctxFn({ data: { projectId } }),
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

  // -------- Location chain
  const [level, setLevel] = useState<string>("");
  const [zoneId, setZoneId] = useState<string>("");
  const levels = useMemo(() => {
    const set = new Set<string>();
    (zones.data ?? []).forEach((z: any) => {
      if (z.level) set.add(z.level);
    });
    return Array.from(set).sort();
  }, [zones.data]);
  const zonesForLevel = useMemo(
    () => (zones.data ?? []).filter((z: any) => !level || z.level === level),
    [zones.data, level],
  );

  // -------- Drawing selection (auto by zone level match)
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const drawingRows = useMemo(() => drawings.data ?? [], [drawings.data]);
  useEffect(() => {
    if (!drawingRows.length) return;
    if (level) {
      const match = drawingRows.find(
        (d: any) => (d.level ?? "").toLowerCase() === level.toLowerCase(),
      );
      if (match) {
        setSelectedDrawing(match.id);
        return;
      }
    }
    if (!selectedDrawing) setSelectedDrawing(drawingRows[0].id);
  }, [drawingRows, level, selectedDrawing]);

  const selectedDrawingRow = useMemo(
    () => drawingRows.find((d: any) => d.id === selectedDrawing) ?? null,
    [drawingRows, selectedDrawing],
  );

  // -------- Pins for this drawing (used for active shift state)
  const pins = useQuery({
    queryKey: ["live-pins", projectId, selectedDrawing],
    queryFn: () => pinsFn({ data: { projectId, drawingId: selectedDrawing!, activeOnly: true } }),
    enabled: ready && !!selectedDrawing,
    refetchInterval: 5000,
  });

  // My active pins (all drawings) → so we can show waiting-permit / active timer
  const myPins = useQuery({
    queryKey: ["my-live-pins", projectId, ctx.data?.email],
    queryFn: () => pinsFn({ data: { projectId, activeOnly: true } }),
    enabled: ready && !!ctx.data,
    refetchInterval: 5000,
  });
  const myActivePin = useMemo(() => {
    const rows = (myPins.data ?? []) as any[];
    // Best-effort: prefer pins created most recently (list is ordered desc).
    return rows[0] ?? null;
  }, [myPins.data]);

  // -------- Briefing form
  const [pending, setPending] = useState<{ xPct: number; yPct: number } | null>(null);
  const [operatives, setOperatives] = useState(1);
  const [taskNotes, setTaskNotes] = useState("");
  const [startTime, setStartTime] = useState(() => toLocalInput(new Date()));
  const [finishTime, setFinishTime] = useState(() =>
    toLocalInput(new Date(Date.now() + 8 * 3600 * 1000)),
  );
  const [busy, setBusy] = useState(false);
  const [checkoutPin, setCheckoutPin] = useState<any | null>(null);

  const tradePkg = ctx.data?.tradePackages?.[0] ?? "";
  const willFlagPermit = HIGH_RISK_RE.test(`${tradePkg} ${taskNotes}`);

  const handleDrop = (coords: { xPct: number; yPct: number }) => {
    if (!selectedDrawing) {
      toast.error("Select a level & drawing first.");
      return;
    }
    setPending(coords);
  };

  const submitBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || !selectedDrawing) return;
    setBusy(true);
    try {
      await createPinFn({
        data: {
          projectId,
          drawingId: selectedDrawing,
          zoneId: zoneId || undefined,
          tradePackage: tradePkg || undefined,
          operativeCount: operatives,
          startTime: new Date(startTime).toISOString(),
          scheduledFinish: new Date(finishTime).toISOString(),
          xPct: pending.xPct,
          yPct: pending.yPct,
          notes: taskNotes.trim() || undefined,
        },
      });
      toast.success(willFlagPermit ? "Briefing logged · awaiting permit" : "Shift launched");
      setPending(null);
      setTaskNotes("");
      qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
      qc.invalidateQueries({ queryKey: ["my-live-pins", projectId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save briefing.");
    } finally {
      setBusy(false);
    }
  };

  // -------- Oracle chat drawer
  const [oracleOpen, setOracleOpen] = useState(false);
  const [oracleInput, setOracleInput] = useState("");
  const [oracleThinking, setOracleThinking] = useState(false);
  const [oracleMsgs, setOracleMsgs] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  const drawingLabel = selectedDrawingRow
    ? `${selectedDrawingRow.drawing_no ?? "DWG"} — ${selectedDrawingRow.title ?? ""}`
    : undefined;

  const sendOracle = async () => {
    const q = oracleInput.trim();
    if (!q || oracleThinking) return;
    setOracleMsgs((m) => [...m, { role: "user", text: q }]);
    setOracleInput("");
    setOracleThinking(true);
    try {
      const res = await askFn({
        data: {
          question: q,
          projectId,
          drawingId: selectedDrawing ?? undefined,
          drawingLabel,
        },
      });
      setOracleMsgs((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch (e: any) {
      setOracleMsgs((m) => [
        ...m,
        { role: "assistant", text: `⚠️ ${e?.message ?? "Oracle failed."}` },
      ]);
    } finally {
      setOracleThinking(false);
    }
  };

  // -------- Active shift timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = (startIso: string) => {
    const ms = now - new Date(startIso).getTime();
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (ctx.isError) return <AccessDeniedScreen message={(ctx.error as Error)?.message} />;

  const welcome = ctx.data?.companyName || ctx.data?.email?.split("@")[0] || "Operative";

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-lg px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
        {/* ---- Welcome header ---- */}
        <header className="glass-panel p-4">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-alert">
            Subcontractor Cockpit
          </p>
          <h1
            className="mt-1 truncate text-xl font-black uppercase leading-tight text-foreground sm:text-2xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            title={`Welcome, ${welcome}`}
          >
            Welcome, {welcome}
          </h1>
          <p className="mt-1 truncate text-xs text-foreground/60">
            {ctx.data?.projectName ?? "Loading project…"}
          </p>
          {ctx.data?.tradePackages?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ctx.data.tradePackages.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-alert/50 bg-alert/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-alert"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </header>


        {/* ---- Oracle card ---- */}
        <button
          type="button"
          onClick={() => setOracleOpen(true)}
          className="glass-panel mt-4 flex w-full items-center gap-3 border-2 border-purple-400/50 bg-gradient-to-r from-purple-600/20 via-fuchsia-500/10 to-alert/20 p-4 text-left transition hover:border-purple-300"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-purple-500/20 text-purple-200">
            <Sparkles size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-purple-200/80">
              ✨ Project AI
            </span>
            <span className="block truncate text-base font-black uppercase tracking-tight text-foreground">
              Ask the Project AI Oracle
            </span>
            <span className="mt-0.5 block truncate text-[0.65rem] text-foreground/60">
              {selectedDrawingRow
                ? `Locked to ${selectedDrawingRow.drawing_no ?? "drawing"}`
                : "Ask any spec, RAMS or drawing question"}
            </span>
          </span>
        </button>

        {/* ---- Active shift state ---- */}
        {myActivePin && (
          <section className="mt-4">
            {myActivePin.permit_status === "required" ? (
              <div className="glass-panel border-2 border-amber-400 bg-amber-500/10 p-4 text-center">
                <ShieldAlert className="mx-auto text-amber-300" size={26} />
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-amber-200">
                  Awaiting Manager Safety Permit Approval…
                </p>
                <p className="mt-1 text-[0.65rem] text-amber-100/70">
                  High-risk task detected. Shift will start automatically the moment your permit is
                  approved.
                </p>
              </div>
            ) : (
              <div className="glass-panel border-2 border-emerald-400 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-emerald-300">
                  <Timer size={12} /> Active shift
                </div>
                <p className="mt-1 font-mono text-3xl font-black tabular-nums text-emerald-100">
                  {elapsed(myActivePin.start_time)}
                </p>
                <p className="mt-1 text-[0.65rem] text-emerald-100/70">
                  {myActivePin.trade_package ?? "Trade"} · {myActivePin.operative_count} ops ·{" "}
                  {myActivePin.work_zones?.name ?? "no zone"}
                </p>
                <button
                  type="button"
                  onClick={() => setCheckoutPin(myActivePin)}
                  className="glass-orange shimmer-btn mt-3 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-xs font-bold uppercase tracking-widest"
                >
                  <LogOut size={14} /> Close Out Today's Shift / Complete Daily Diary
                </button>
              </div>
            )}
          </section>
        )}

        {/* ---- Location dropdowns ---- */}
        <section className="mt-4 grid grid-cols-1 gap-3">
          <label className="glass-panel p-3">
            <span className="mb-1 flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              <Layers size={12} /> Project Level
            </span>
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setZoneId("");
              }}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-3 font-mono text-sm text-foreground outline-none focus:border-alert"
            >
              <option value="">— Select level —</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="glass-panel p-3">
            <span className="mb-1 flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              <MapPin size={12} /> Active Work Zone
            </span>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              disabled={!level && levels.length > 0}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-3 font-mono text-sm text-foreground outline-none focus:border-alert disabled:opacity-50"
            >
              <option value="">— Select zone —</option>
              {zonesForLevel.map((z: any) => (
                <option key={z.id} value={z.id} disabled={z.status === "closed"}>
                  {z.name}
                  {z.status === "closed" ? " — CLOSED" : ""}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* ---- Drawing viewer / pin canvas ---- */}
        <section className="mt-4">
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Tap the blueprint to drop your morning pin
          </p>
          <DrawingCanvas
            drawings={drawingRows as never}
            selectedId={selectedDrawing}
            onSelect={setSelectedDrawing}
            onLockOracle={() => setOracleOpen(true)}
            pins={(pins.data ?? []) as never}
            pinMode={myActivePin ? "view" : "drop"}
            onDropPin={handleDrop}
          />
        </section>

        <section className="mt-6">
          <Link
            to="/dabs/$projectId"
            params={{ projectId }}
            className="glass-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[0.65rem] uppercase tracking-wider"
          >
            <ClipboardList size={12} /> Full DABS View
          </Link>
        </section>
      </div>

      {/* ---- Briefing modal ---- */}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur sm:items-center">
          <form
            onSubmit={submitBriefing}
            className="glass-panel w-full max-w-md rounded-t-2xl border-2 border-alert p-5 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-alert">
                  Morning Briefing
                </p>
                <h3
                  className="mt-0.5 text-lg font-black uppercase tracking-tight text-foreground"
                  style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
                >
                  Launch Shift
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-sm border border-white/15 p-1.5 text-foreground/60"
              >
                <X size={14} />
              </button>
            </div>

            {/* Operative stepper */}
            <div className="mt-4">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                Operative Count
              </span>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOperatives((n) => Math.max(1, n - 1))}
                  className="grid h-12 w-12 place-items-center rounded-xl border border-white/20 bg-black/40 text-foreground active:scale-95"
                >
                  <Minus size={18} />
                </button>
                <div className="flex-1 rounded-xl border border-white/15 bg-black/40 py-3 text-center font-mono text-3xl font-black text-foreground">
                  {operatives}
                </div>
                <button
                  type="button"
                  onClick={() => setOperatives((n) => Math.min(500, n + 1))}
                  className="grid h-12 w-12 place-items-center rounded-xl border border-white/20 bg-black/40 text-foreground active:scale-95"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                  Start
                </span>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2.5 font-mono text-xs text-foreground outline-none focus:border-alert"
                />
              </label>
              <label className="block">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                  Finish
                </span>
                <input
                  type="datetime-local"
                  required
                  value={finishTime}
                  onChange={(e) => setFinishTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2.5 font-mono text-xs text-foreground outline-none focus:border-alert"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                Task Description
              </span>
              <textarea
                rows={3}
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Describe today's work, e.g., welding beams or erecting towers"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
            </label>

            {willFlagPermit && (
              <div className="mt-3 flex items-start gap-2 rounded-md border-2 border-amber-400 bg-amber-400/10 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-widest text-amber-200">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                High-Risk Task Detected. This briefing will require an Admin Permit to Work before
                activation.
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="glass-orange shimmer-btn mt-5 w-full rounded-xl px-4 py-4 text-sm font-black uppercase tracking-widest disabled:opacity-40"
            >
              {busy ? "Launching…" : "Confirm Morning Briefing & Launch Shift"}
            </button>
          </form>
        </div>
      )}

      {/* ---- Oracle chat drawer ---- */}
      {oracleOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur sm:items-center">
          <div className="glass-panel flex h-[92dvh] max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-2 border-purple-400/60 sm:h-[85dvh] sm:rounded-2xl">

            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-300" size={18} />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-foreground">
                    Project Oracle
                  </p>
                  {drawingLabel && (
                    <p className="truncate text-[0.6rem] text-purple-200/80">🔒 {drawingLabel}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOracleOpen(false)}
                className="rounded-sm border border-white/15 p-1.5 text-foreground/60"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {oracleMsgs.length === 0 && !oracleThinking && (
                <div className="rounded-xl border border-purple-400/30 bg-purple-500/5 p-4 text-xs text-foreground/70">
                  Ask a spec, dimension, or safety question — e.g. "Minimum concrete grade for this
                  pad foundation?" The Oracle reads this project's drawings, RAMS and logistics
                  documents only.
                </div>
              )}
              {oracleMsgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-alert px-3 py-2 text-sm text-black">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="max-w-full text-sm text-foreground/90">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  </div>
                ),
              )}
              {oracleThinking && (
                <p className="flex items-center gap-2 text-xs text-foreground/60">
                  <Loader2 className="animate-spin" size={12} /> Oracle is thinking…
                </p>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendOracle();
              }}
              className="flex items-center gap-2 border-t border-white/10 p-3"
            >
              <input
                value={oracleInput}
                onChange={(e) => setOracleInput(e.target.value)}
                placeholder="Ask the Oracle…"
                className="flex-1 rounded-full border border-white/15 bg-black/40 px-4 py-3 text-sm text-foreground outline-none focus:border-purple-300"
              />
              <button
                type="submit"
                disabled={oracleThinking || !oracleInput.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-purple-500 text-white disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
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
          onClose={() => {
            setCheckoutPin(null);
            qc.invalidateQueries({ queryKey: ["my-live-pins", projectId] });
          }}
        />
      )}
    </div>
  );
}
