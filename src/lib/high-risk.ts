/**
 * Canonical high-risk hazard vocabulary.
 *
 * This is the single source of truth on the client and MUST stay in lockstep
 * with the Postgres trigger `public.detect_pin_high_risk()` and the helper
 * `public.high_risk_categories()`. The test in `src/lib/high-risk.test.ts`
 * asserts the two lists agree.
 *
 * Keep this module generic: it takes text and returns hazard keys. No
 * page-specific behaviour belongs here — DABS, the subcontractor cockpit and
 * the activities validator all consume it for different reasons.
 */

export const HIGH_RISK_CATEGORIES = [
  "hot_works",
  "confined_space",
  "working_at_height",
  "excavation",
  "deep_excavation",
  "lifting_operations",
  "overhead_powerlines",
  "demolition",
] as const;

export type HazardKey = (typeof HIGH_RISK_CATEGORIES)[number];

export const HAZARD_LABELS: Record<HazardKey, string> = {
  hot_works: "Hot Works",
  confined_space: "Confined Space",
  working_at_height: "Working at Height",
  excavation: "Excavation",
  deep_excavation: "Deep Excavation (≥1.2m)",
  lifting_operations: "Lifting Operations (LOLER)",
  overhead_powerlines: "Overhead Power Lines",
  demolition: "Demolition",
};

/** Regex patterns mirroring the SQL in public.detect_pin_high_risk(). */
export const HAZARD_PATTERNS: Record<HazardKey, RegExp> = {
  hot_works:
    /(hot\s*work|welding|cutting torch|grinding|brazing|soldering|oxy[- ]?acetylene|naked flame)/i,
  confined_space:
    /(confined\s*space|tank entry|manhole|vessel entry|chamber entry)/i,
  working_at_height:
    /(work(ing)?\s*at\s*height|scaffold|roof(ing)?|mewp|cherry\s*picker|ladder work|edge protection|fall(ing)? from height|leading edge)/i,
  excavation:
    /(excavat(ion|ing)|dig(ging)?|trench|groundworks|underground service|buried service)/i,
  deep_excavation:
    /(1\.2\s*m|1\.5\s*m|2\s*m|deep excavat|deep trench|shoring|trench box|shored)/i,
  lifting_operations:
    /(lift(ing)?\s*operation|loler|mobile\s*crane|tower\s*crane|crawler\s*crane|contract\s*lift|tandem lift|hiab|lorry loader|telehandler|slinger|banksman|rigger|lift\s*plan|lifting\s*plan|steel(work)?\s*erect|beam\s*lift|precast\s*lift|structural\s*steel)/i,
  overhead_powerlines:
    /(overhead\s*(power\s*)?line|overhead\s*cable|hv\s*cable|11\s*kv|33\s*kv|400\s*kv|live\s*(cable|conductor|overhead)|gs6|exclusion\s*zone|proximity to overhead)/i,
  demolition: /(demolition|soft strip|structural strip|controlled collapse)/i,
};

/** Returns the hazard keys detected in a free-text description. */
export function detectHazards(text: string): HazardKey[] {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return [];
  return HIGH_RISK_CATEGORIES.filter((key) => HAZARD_PATTERNS[key].test(t));
}

/** Human-readable label for a hazard key (falls back to de-snake-casing). */
export function hazardLabel(key: string): string {
  return (
    HAZARD_LABELS[key as HazardKey] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
