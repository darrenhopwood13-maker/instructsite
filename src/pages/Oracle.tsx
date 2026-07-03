import { useState } from "react";
import { Wrench, ShieldAlert, ShoppingBag, FileSearch, ClipboardCheck, Brain, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runOracleCommand } from "@/lib/oracle.functions";
import { MarkdownRenderer } from "@/components/ui/markdown";

const COMMANDS = [
  { key: "installation", label: "Installation Sequence", icon: Wrench, desc: "Step-by-step build & commissioning" },
  { key: "safety", label: "Safety Auditor", icon: ShieldAlert, desc: "Risk, RAMS, compliance checks" },
  { key: "procurement", label: "Procurement", icon: ShoppingBag, desc: "BOMs, vendors, lead times" },
  { key: "drawing", label: "Drawing Q&A", icon: FileSearch, desc: "Query technical drawings" },
  { key: "snag", label: "Snag Master", icon: ClipboardCheck, desc: "Defect capture & tracking" },
  { key: "assist", label: "AI Assist", icon: Brain, desc: "On-site knowledge co-pilot" },
];

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

    try {
      const result = await invokeOracle({ data: { key: cmd.key } });
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

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            const isLoading = loadingKey === cmd.key;
            return (
              <button
                key={cmd.key}
                type="button"
                disabled={loadingKey !== null}
                onClick={() => handleInvoke(cmd)}
                className="glass-panel group flex flex-col items-start gap-4 p-6 text-left transition-transform hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="glass-accent flex h-12 w-12 items-center justify-center">
                  {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Icon size={22} />}
                </div>
                <div>
                  <div className="font-display text-lg font-bold text-foreground">
                    {cmd.label}
                  </div>
                  <div className="mt-1 text-sm text-foreground/60">
                    {cmd.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
                <div className="flex items-center gap-3 text-foreground/70">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Consulting the Oracle…</span>
                </div>
              ) : error ? (
                <div className="glass-accent p-4 text-sm text-alert">{error}</div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/85">
                  {answer}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OraclePage;
