import { Wrench, ShieldAlert, ShoppingBag, FileSearch, ClipboardCheck, Brain } from "lucide-react";

const COMMANDS = [
  { key: "installation", label: "Installation Sequence", icon: Wrench, desc: "Step-by-step build & commissioning" },
  { key: "safety", label: "Safety Auditor", icon: ShieldAlert, desc: "Risk, RAMS, compliance checks" },
  { key: "procurement", label: "Procurement", icon: ShoppingBag, desc: "BOMs, vendors, lead times" },
  { key: "drawing", label: "Drawing Q&A", icon: FileSearch, desc: "Query technical drawings" },
  { key: "snag", label: "Snag Master", icon: ClipboardCheck, desc: "Defect capture & tracking" },
  { key: "assist", label: "AI Assist", icon: Brain, desc: "On-site knowledge co-pilot" },
];

const OraclePage = () => {
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
            return (
              <button
                key={cmd.key}
                type="button"
                className="glass-panel group flex flex-col items-start gap-4 p-6 text-left transition-transform hover:-translate-y-1"
              >
                <div className="glass-accent flex h-12 w-12 items-center justify-center">
                  <Icon size={22} />
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
    </div>
  );
};

export default OraclePage;
