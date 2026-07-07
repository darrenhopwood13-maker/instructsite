import { useEffect, useState } from "react";
import { Wrench, ShieldAlert, ShoppingBag, FileSearch, ClipboardCheck, Brain, Loader2, X, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runOracleCommand } from "@/lib/oracle.functions";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { ProjectBibleUpload } from "@/components/oracle/ProjectBibleUpload";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

import cmdInstallation from "@/assets/cmd-installation.jpg";
import cmdSafety from "@/assets/cmd-safety.jpg";
import cmdProcurement from "@/assets/cmd-procurement.jpg";
import cmdDrawing from "@/assets/cmd-drawing.jpg";
import cmdSnag from "@/assets/cmd-snag.jpg";
import cmdAssist from "@/assets/cmd-assist.jpg";

const COMMANDS = [
  { key: "installation", label: "Installation Sequence", sub: "Build order & trade coordination", icon: Wrench,         desc: "Step-by-step build & commissioning", image: cmdInstallation, accent: "from-amber-500/20 to-orange-600/30" },
  { key: "safety",       label: "Safety Auditor",        sub: "BSR risk & compliance",            icon: ShieldAlert,    desc: "Risk, RAMS, compliance checks",      image: cmdSafety,       accent: "from-yellow-400/20 to-red-500/30" },
  { key: "procurement",  label: "Procurement",           sub: "Identify & source materials",      icon: ShoppingBag,    desc: "BOMs, vendors, lead times",          image: cmdProcurement,  accent: "from-orange-400/20 to-amber-700/30" },
  { key: "drawing",      label: "Drawing Q&A",           sub: "Symbols, datums, MBC details",     icon: FileSearch,     desc: "Query technical drawings",           image: cmdDrawing,      accent: "from-sky-400/20 to-blue-700/30" },
  { key: "snag",         label: "Snag Master",           sub: "RICS-standard rectification",      icon: ClipboardCheck, desc: "Defect capture & tracking",          image: cmdSnag,         accent: "from-emerald-400/20 to-green-700/30" },
  { key: "assist",       label: "AI Assist",             sub: "Cross-trade problem solving",      icon: Brain,          desc: "On-site knowledge co-pilot",         image: cmdAssist,       accent: "from-lime-400/30 to-emerald-700/40" },
];
const PROCESSING_STEPS = [
  "Locking on to project context…",
  "Retrieving drawings & documents…",
  "Cross-referencing site data…",
  "Reasoning through the request…",
  "Composing response…",
];

function OracleProcessing({ label }: { label: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % PROCESSING_STEPS.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="glass-panel relative overflow-hidden p-6">
      {/* Animated scan line */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="oracle-scanline absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-alert/30 to-transparent blur-md" />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-alert/30" />
          <span className="absolute inset-1 rounded-full bg-alert/15" />
          <Sparkles size={20} className="relative animate-pulse text-alert" />
        </div>
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-alert">
            {label} · Processing
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-foreground/80">
            <Loader2 className="animate-spin" size={14} />
            <span key={step} className="animate-fade-in">{PROCESSING_STEPS[step]}</span>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="relative mt-5 flex items-center gap-1.5">
        {PROCESSING_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i <= step ? "bg-alert" : "bg-foreground/10"
            }`}
          />
        ))}
      </div>

      {/* Shimmer bars */}
      <div className="relative mt-5 space-y-2">
        <div className="oracle-shimmer h-2.5 w-3/4 rounded" />
        <div className="oracle-shimmer h-2.5 w-5/6 rounded" />
        <div className="oracle-shimmer h-2.5 w-2/3 rounded" />
      </div>
    </div>
  );
}


const OraclePage = () => {
  const invokeOracle = useServerFn(runOracleCommand);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleInvoke = async (cmd: { key: string; label: string }) => {
    setLoadingKey(cmd.key);
    setError(null);
    setAnswer("");
    setActiveLabel(cmd.label);
    setDialogOpen(true);

    // Read locked oracle context from session (set by "Lock to Oracle" button)
    let projectId: string | undefined;
    let lockedContext:
      | { kind: "drawing" | "zone"; id: string; label: string }
      | undefined;
    try {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("oracle:context")
          : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.projectId) projectId = parsed.projectId;
        if (parsed?.kind && parsed?.id && parsed?.label) {
          lockedContext = {
            kind: parsed.kind,
            id: parsed.id,
            label: parsed.label,
          };
        }
      }
    } catch {
      // ignore malformed context
    }

    try {
      await ensureOracleSession();
      const result = await invokeOracle({
        data: { key: cmd.key, projectId, lockedContext },
      });
      setAnswer(result?.answer ?? "No response returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the Oracle.");
    } finally {
      setLoadingKey(null);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setAnswer("");
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background p-6">
      <div className="aurora-bg" />
      <div className="grain-overlay" />

      <div className="relative mx-auto max-w-6xl py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-alert">
          AI · Modules
        </p>
        <h1
          className="mt-3 text-5xl font-extrabold uppercase tracking-tight text-foreground"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Oracle Tooling
        </h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          AI-powered support for site operations.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3">
          {COMMANDS.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isLoading = loadingKey === cmd.key;
            return (
              <button
                key={cmd.key}
                type="button"
                disabled={loadingKey !== null}
                onClick={() => handleInvoke(cmd)}
                className="cmd-tile shine animate-fade-up h-36 text-left disabled:cursor-not-allowed disabled:opacity-60"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <img
                  src={cmd.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className={`absolute inset-0 z-[1] bg-gradient-to-tr ${cmd.accent} mix-blend-overlay`} />
                <div className="relative z-[2] flex h-full flex-col justify-between p-3 text-white">
                  <div className="glass-dark inline-flex h-8 w-8 items-center justify-center rounded-lg self-start">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Icon className="h-4 w-4 text-accent" />}
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold leading-tight tracking-tight drop-shadow-md">
                      {cmd.label}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-white/85 drop-shadow">
                      {cmd.sub}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <ProjectBibleUpload />
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={closeDialog}
        >
          <div
            className="glass-panel relative w-full max-w-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDialog}
              className="glass-accent absolute right-4 top-4 flex h-9 w-9 items-center justify-center"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-alert">
              Oracle Response
            </p>
            <h2
              className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {activeLabel}
            </h2>

            <div className="mt-6 min-h-[120px]">
              {loadingKey !== null ? (
                <OracleProcessing label={activeLabel} />
              ) : error ? (
                <div className="glass-accent p-4 text-sm text-alert">{error}</div>
              ) : (
                <div className="glass-panel max-h-[60vh] overflow-y-auto p-6">
                  <MarkdownRenderer content={answer} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OraclePage;
