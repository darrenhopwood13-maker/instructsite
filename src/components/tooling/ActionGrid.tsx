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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {ACTIONS.map(({ key, label, sub, code, image, premium }) => {
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
              "group relative aspect-[4/5] sm:aspect-[3/4] text-left rounded-2xl overflow-hidden",
              "border border-white/10 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)]",
              "transition-all duration-300 will-change-transform",
              "hover:border-primary/70 hover:-translate-y-1 hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              "disabled:opacity-50 disabled:pointer-events-none",
              premium && "border-alert/50 hover:border-alert",
              isActive && !premium && "ring-2 ring-primary",
              isActive && premium && "ring-2 ring-alert",
            )}
          >
            {/* Cinematic backdrop */}
            <img
              src={image}
              alt=""
              loading="lazy"
              width={1280}
              height={832}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Legibility gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-transparent" />

            {/* Code / status */}
            <span
              className={cn(
                "absolute top-3 right-3 font-mono text-[10px] tracking-widest px-1.5 py-0.5 rounded-md border backdrop-blur",
                premium
                  ? "text-alert border-alert/50 bg-black/40"
                  : "text-primary border-primary/40 bg-black/40",
              )}
            >
              {isLoading ? "● RUN" : code}
            </span>

            {premium && !isLoading && (
              <span className="absolute top-3 left-3 font-mono text-[10px] tracking-widest text-alert bg-black/40 border border-alert/50 rounded-md px-1.5 py-0.5 backdrop-blur">
                ✦ PRO
              </span>
            )}

            {isLoading && (
              <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-primary bg-black/50 border border-primary/50 rounded-md px-2 py-0.5 backdrop-blur">
                <Loader2 size={11} className="animate-spin" /> RUNNING
              </span>
            )}

            {/* Text block */}
            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <div className="font-display text-[15px] sm:text-[17px] leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {label}
              </div>
              <div className="text-[11.5px] sm:text-xs mt-1 leading-snug text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] line-clamp-2">
                {isLoading ? "The Oracle is analysing…" : sub}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
