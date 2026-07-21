import {
  ListOrdered,
  ShieldAlert,
  Truck,
  FileSearch,
  ClipboardCheck,
  Sparkles,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FunctionKey =
  | "installation_sequence"
  | "safety_auditor"
  | "procurement"
  | "drawing_qa"
  | "snag_master"
  | "ai_assist";

interface Action {
  key: FunctionKey;
  label: string;
  sub: string;
  icon: LucideIcon;
  code: string;
  premium?: boolean;
}

const ACTIONS: Action[] = [
  { key: "installation_sequence", label: "Installation Sequence", sub: "Step-by-step build order + BY OTHERS", icon: ListOrdered, code: "01" },
  { key: "safety_auditor", label: "Safety Auditor", sub: "BSR / CDM / working at height", icon: ShieldAlert, code: "02" },
  { key: "procurement", label: "Procurement", sub: "Lead times & long-lead risks", icon: Truck, code: "03" },
  { key: "drawing_qa", label: "Drawing Q&A", sub: "Ask a question of the drawing", icon: FileSearch, code: "04" },
  { key: "snag_master", label: "Snag Master", sub: "Photo-based defect grading", icon: ClipboardCheck, code: "05" },
  { key: "ai_assist", label: "Ask The Oracle", sub: "Full Clerk-of-Works reasoning", icon: Sparkles, code: "06", premium: true },
];

export const ACTION_LABELS: Record<FunctionKey, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.key, a.label]),
) as Record<FunctionKey, string>;

interface Props {
  onSelect: (key: FunctionKey) => void;
  disabled: boolean;
  active: FunctionKey | null;
  loading?: boolean;
}

export const ActionGrid = ({ onSelect, disabled, active, loading = false }: Props) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ACTIONS.map(({ key, label, sub, icon: Icon, code, premium }) => {
        const isActive = active === key;
        const isLoading = loading && isActive;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(key)}
            aria-busy={isLoading}
            className={cn(
              "group relative p-4 text-left rounded-xl overflow-hidden",
              "bg-white/[0.04] backdrop-blur-md",
              "border border-white/10 transition-all duration-200",
              "hover:border-primary/60 hover:-translate-y-0.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              "disabled:opacity-40 disabled:pointer-events-none",
              premium && "border-alert/40",
              isActive && !premium && "border-primary bg-primary/10",
              isActive && premium && "border-alert bg-alert/10",
              isLoading && "!opacity-100",
            )}
          >
            <span
              className={cn(
                "absolute top-2.5 right-3 font-mono text-[10px] tracking-widest",
                premium ? "text-alert/80" : "text-primary/70",
              )}
            >
              {isLoading ? "● RUN" : code}
            </span>

            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all border",
                  premium
                    ? "bg-alert/15 text-alert border-alert/40"
                    : "bg-primary/10 text-primary border-primary/30",
                )}
              >
                {isLoading ? (
                  <Loader2 size={20} strokeWidth={2.4} className="animate-spin" />
                ) : (
                  <Icon size={20} strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[15px] leading-tight text-foreground">{label}</div>
                <div className="text-[11.5px] mt-1 leading-snug text-muted-foreground">
                  {isLoading ? "Running…" : sub}
                </div>
              </div>
            </div>

            {premium && !isLoading && (
              <span className="absolute bottom-2.5 right-3 font-mono text-[10px] tracking-widest text-alert/90">
                ✦ PRO
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
