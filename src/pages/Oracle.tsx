import { Card } from "@/components/ui/card";
import { Wrench, ShieldAlert, ShoppingBag, FileSearch, ClipboardCheck, Brain } from "lucide-react";

const COMMANDS = [
  { key: "installation", label: "Installation Sequence", icon: Wrench, accent: "bg-orange-600" },
  { key: "safety", label: "Safety Auditor", icon: ShieldAlert, accent: "bg-red-500" },
  { key: "procurement", label: "Procurement", icon: ShoppingBag, accent: "bg-amber-700" },
  { key: "drawing", label: "Drawing Q&A", icon: FileSearch, accent: "bg-blue-700" },
  { key: "snag", label: "Snag Master", icon: ClipboardCheck, accent: "bg-green-700" },
  { key: "assist", label: "AI Assist", icon: Brain, accent: "bg-emerald-700" },
];

const OraclePage = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">ORACLE TOOLING</h1>
        <p className="mt-2 text-muted-foreground">AI-powered support for site operations.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <Card
                key={cmd.key}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-accent"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${cmd.accent}`}
                >
                  <Icon size={20} />
                </div>
                <span className="font-medium text-foreground">{cmd.label}</span>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OraclePage;
