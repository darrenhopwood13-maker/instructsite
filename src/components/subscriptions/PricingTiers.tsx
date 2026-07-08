import { Check, Sparkles } from "lucide-react";
import type { Tier } from "@/lib/access";

interface TierDef {
  key: Tier;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  accent: "slate" | "orange" | "gradient";
  cta: string;
}

export const TIER_DEFS: TierDef[] = [
  {
    key: "baseline",
    name: "Baseline",
    price: "£299",
    cadence: "per month · per project",
    tagline: "Essential command surface.",
    features: [
      "DABS mobile cockpit",
      "Daily Site Diary",
      "Oracle AI (6 command modules)",
      "PWA · Offline capture",
      "1 project · Unlimited crews",
    ],
    accent: "slate",
    cta: "Start Baseline",
  },
  {
    key: "structure",
    name: "Structure",
    price: "£599",
    cadence: "per month · per project",
    tagline: "Everything in Baseline, plus verification.",
    features: [
      "BIM Viewport (IFC 4x3 · 100k+ elements)",
      "Randall Auto-Pilot programme engine",
      "Green-mesh 3D progress overlay",
      "QS payment verification queue",
      "Priority Oracle latency",
    ],
    accent: "orange",
    cta: "Upgrade to Structure",
  },
  {
    key: "apex",
    name: "Apex",
    price: "Bespoke",
    cadence: "contact for pricing",
    tagline: "Enterprise governance & integrations.",
    features: [
      "Full ERP / COINS Bridge",
      "Enterprise SSO (SAML / OIDC)",
      "Green-Mesh Verification with audit trail",
      "Dedicated Technical Account Manager",
      "99.9% SLA · Priority support",
    ],
    accent: "gradient",
    cta: "Request Bespoke",
  },
];

interface Props {
  currentTier?: Tier | null;
  onSelect: (tier: Tier) => void;
  loadingTier?: Tier | null;
  compact?: boolean;
}

export function PricingTiers({ currentTier, onSelect, loadingTier, compact }: Props) {
  return (
    <div className={`grid gap-4 ${compact ? "md:grid-cols-3" : "md:grid-cols-3"}`}>
      {TIER_DEFS.map((t) => {
        const isCurrent = currentTier === t.key;
        const highlight = t.key === "structure";
        return (
          <div
            key={t.key}
            className={`relative flex flex-col overflow-hidden rounded-lg border-2 p-6 transition ${
              highlight
                ? "border-[#FB923C] bg-[#0A192F] text-white shadow-[0_20px_50px_-20px_rgba(251,146,60,0.5)]"
                : t.accent === "gradient"
                  ? "border-[#1E293B] bg-gradient-to-b from-[#0A192F] to-[#1E293B] text-white"
                  : "border-[#1E293B] bg-[#0A192F] text-white"
            }`}
          >
            {highlight && (
              <div className="absolute right-4 top-4 rounded-full bg-[#FB923C] px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.24em] text-[#0A192F]">
                Most popular
              </div>
            )}
            {t.accent === "gradient" && (
              <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-[#FB923C]/60 bg-[#FB923C]/10 px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.24em] text-[#FB923C]">
                <Sparkles size={9} /> Enterprise
              </div>
            )}

            <p className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-white/60">
              {t.name}
            </p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-black tracking-tight">{t.price}</span>
              {t.price !== "Bespoke" && (
                <span className="text-xs text-white/50">/mo</span>
              )}
            </div>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-white/40">
              {t.cadence}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/75">{t.tagline}</p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
                  <span
                    className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full ${
                      highlight ? "bg-[#FB923C] text-[#0A192F]" : "bg-white/10 text-[#FB923C]"
                    }`}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => onSelect(t.key)}
              disabled={isCurrent || loadingTier === t.key}
              className={`mt-6 inline-flex items-center justify-center gap-2 rounded-md border-2 px-5 py-3 text-[0.7rem] font-extrabold uppercase tracking-[0.28em] transition disabled:opacity-60 ${
                isCurrent
                  ? "border-white/20 bg-white/5 text-white/50"
                  : highlight
                    ? "border-[#FB923C] bg-[#FB923C] text-[#0A192F] hover:brightness-110"
                    : t.accent === "gradient"
                      ? "border-[#FB923C] bg-transparent text-[#FB923C] hover:bg-[#FB923C] hover:text-[#0A192F]"
                      : "border-white/20 bg-transparent text-white hover:border-[#FB923C] hover:text-[#FB923C]"
              }`}
            >
              {isCurrent
                ? "Current Plan"
                : loadingTier === t.key
                  ? "Redirecting…"
                  : t.cta}
            </button>
          </div>
        );
      })}
    </div>
  );
}
