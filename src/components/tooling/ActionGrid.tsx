import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import img01 from "@/assets/tooling/01-sequence.jpg";
import img02 from "@/assets/tooling/02-safety.jpg";
import img03 from "@/assets/tooling/03-procurement.jpg";
import img04 from "@/assets/tooling/04-drawing.jpg";
import img05 from "@/assets/tooling/05-snag.jpg";
import img06 from "@/assets/tooling/06-oracle.jpg";

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
  code: string;
  image: string;
  premium?: boolean;
}

const ACTIONS: Action[] = [
  { key: "installation_sequence", label: "Installation Sequence", sub: "Step-by-step build order + BY OTHERS", code: "01", image: img01 },
  { key: "safety_auditor",       label: "Safety Auditor",         sub: "BSR / CDM / working at height",       code: "02", image: img02 },
  { key: "procurement",          label: "Procurement",            sub: "Lead times & long-lead risks",         code: "03", image: img03 },
  { key: "drawing_qa",           label: "Drawing Q&A",            sub: "Ask a question of the drawing",        code: "04", image: img04 },
  { key: "snag_master",          label: "Snag Master",            sub: "Photo-based defect grading",           code: "05", image: img05 },
  { key: "ai_assist",            label: "Ask The Oracle",         sub: "Full Clerk-of-Works reasoning",        code: "06", image: img06, premium: true },
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {ACTIONS.map(({ key, label, sub, image, premium }) => {
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
              "group relative aspect-[16/9] text-left rounded-2xl overflow-hidden",
              "border border-border shadow-md",
              "transition-all duration-300",
              "hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              "disabled:opacity-50 disabled:pointer-events-none",
              isActive && !premium && "ring-2 ring-primary",
              isActive && premium && "ring-2 ring-alert",
            )}
          >
            <img
              src={image}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ filter: "brightness(1.15) saturate(1.05)" }}
            />
            {/* Softer legibility gradient — bottom only */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            {/* Corner badge */}
            <span
              className={cn(
                "absolute top-2.5 left-2.5 h-7 w-7 grid place-items-center rounded-lg backdrop-blur",
                premium
                  ? "bg-alert/25 border border-alert/60 text-alert-foreground"
                  : "bg-emerald-500/30 border border-emerald-400/60 text-white",
              )}
            >
              {isLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : premium ? (
                <span className="text-[10px] font-bold">✦</span>
              ) : (
                <span className="text-[10px] font-bold">◆</span>
              )}
            </span>

            {/* Text block */}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="font-display font-bold text-[15px] sm:text-base leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {label}
              </div>
              <div className="text-[11px] sm:text-[12px] mt-0.5 leading-snug text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] line-clamp-1">
                {isLoading ? "The Oracle is analysing…" : sub}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
