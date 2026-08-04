// Single source of truth for trade package names.
//
// Previously two different screens (TradeDirectoryPanel.tsx and
// subcontractors.new.tsx) each had their own hardcoded list, and both
// wrote free text from their list into the same subcontractor_invites
// .trade_packages column with nothing enforcing they matched — e.g. one
// screen offered "Structural Steels" and "M&E", the other offered "Steel
// Frame" and separate "Mechanical" / "Electrical" / "Plumbing" entries.
// Anything that reads trade_package by exact value (like the personal
// Site Manager diary's package-to-activity linking) could silently miss
// data depending on which screen was used to register a subcontractor.
//
// This is now the only place trade names are defined. Both registration
// screens import from here. If you need to change or add a trade, change
// it here — do not add a new hardcoded list elsewhere.
export const TRADE_PACKAGES = [
  "Groundworks",
  "Concrete Frame",
  "Steel Frame",
  "Cladding",
  "Roofing",
  "Windows & Curtain Wall",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Drylining & Plaster",
  "Joinery & Carpentry",
  "Painting & Decorating",
  "Flooring",
  "Ceilings",
  "Lifts",
  "Fire Protection",
  "Landscaping",
  "Demolition",
  "Scaffolding",
  "Cleaning",
  "Strip-Out & Enabling Works",
  "Structural Steelwork",
  "M&E",
  "Plastering & Drylining",
] as const;

export type TradePackage = (typeof TRADE_PACKAGES)[number];

/** Catch-all used when no trade can be determined. Not offered as a choice. */
export const GENERAL_TRADE = "General";

/**
 * Legacy / near-duplicate trade names that historically got written into the
 * database (e.g. "Roofing & Leadwork" alongside "Roofing"). Everything is
 * folded onto the canonical list above so dropdowns can never show two
 * spellings of the same trade again. Keys are lower-cased.
 */
export const TRADE_ALIASES: Record<string, TradePackage> = {
  "roofing & leadwork": "Roofing",
  "roofing and leadwork": "Roofing",
  "roofing, tiling and leadwork": "Roofing",
  leadwork: "Roofing",
  "tiling & roofing": "Roofing",
  groundwork: "Groundworks",
  "ground works": "Groundworks",
  "civils & groundworks": "Groundworks",
  excavation: "Groundworks",
  "substructure & groundworks": "Groundworks",
  "structural steels": "Steel Frame",
  "structural steel": "Steel Frame",
  steelwork: "Steel Frame",
  "steel erection": "Steel Frame",
  "mechanical & electrical": "Mechanical",
  "mechanical services": "Mechanical",
  hvac: "Mechanical",
  "electrical installation": "Electrical",
  electrics: "Electrical",
  "plumbing & heating": "Plumbing",
  carpentry: "Joinery & Carpentry",
  joinery: "Joinery & Carpentry",
  "carpentry & joinery": "Joinery & Carpentry",
  "1st & 2nd fix carpentry": "Joinery & Carpentry",
  drylining: "Drylining & Plaster",
  plastering: "Drylining & Plaster",
  "dry lining": "Drylining & Plaster",
  "painting & decorating": "Painting & Decorating",
  decorating: "Painting & Decorating",
  painting: "Painting & Decorating",
  scaffold: "Scaffolding",
  "scaffold access": "Scaffolding",
  "access & scaffolding": "Scaffolding",
  "windows & glazing": "Windows & Curtain Wall",
  glazing: "Windows & Curtain Wall",
  curtain: "Windows & Curtain Wall",
  "fire stopping": "Fire Protection",
  firestopping: "Fire Protection",
  "concrete frame & rc": "Concrete Frame",
  "rc frame": "Concrete Frame",
  "external works & landscaping": "Landscaping",
  "soft landscaping": "Landscaping",
  "site clean": "Cleaning",
};

const CANONICAL_BY_LOWER: Record<string, TradePackage> = Object.fromEntries(
  TRADE_PACKAGES.map((t) => [t.toLowerCase(), t]),
) as Record<string, TradePackage>;

/**
 * Fold any stored trade string onto the canonical list. Unknown values are
 * returned trimmed and unchanged so bespoke trades aren't destroyed.
 */
export function canonicalizeTrade(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return CANONICAL_BY_LOWER[key] ?? TRADE_ALIASES[key] ?? raw;
}

/** Keyword signals used to infer a trade from a document title / text. */
const TRADE_SIGNALS: Array<[TradePackage, RegExp]> = [
  ["Groundworks", /\b(groundwork|excavat|substructure|foundation|drainage|muck away|trench|dig)\w*/i],
  ["Steel Frame", /\b(structural steel|steelwork|steel erect|steel frame|beam erect)\w*/i],
  ["Concrete Frame", /\b(rc frame|concrete frame|formwork|rebar|reinforced concrete)\w*/i],
  ["Roofing", /\b(roofing|roof tiling|leadwork|felt roof|slating|roof covering)\w*/i],
  ["Scaffolding", /\b(scaffold|access tower|edge protection erect)\w*/i],
  ["Mechanical", /\b(mechanical|pipework|ductwork|hvac|ventilation|heating install)\w*/i],
  ["Electrical", /\b(electrical|containment|temporary supplies|cabling|distribution board)\w*/i],
  ["Plumbing", /\b(plumbing|sanitaryware|soil stack|water services)\w*/i],
  ["Joinery & Carpentry", /\b(carpentry|joinery|roof cut|first fix timber|second fix timber|stud work)\w*/i],
  ["Drylining & Plaster", /\b(drylining|dry lining|plaster|skim|partition board)\w*/i],
  ["Painting & Decorating", /\b(painting|decorat|coating application)\w*/i],
  ["Cladding", /\b(cladding|rainscreen|render system|facade)\w*/i],
  ["Windows & Curtain Wall", /\b(window install|curtain wall|glazing|glass install)\w*/i],
  ["Flooring", /\b(flooring|screed|floor finishes|carpet lay|resin floor)\w*/i],
  ["Ceilings", /\b(suspended ceiling|ceiling grid|mf ceiling)\w*/i],
  ["Lifts", /\b(lift install|elevator|lift shaft)\w*/i],
  ["Fire Protection", /\b(fire stopping|firestopping|sprinkler|fire alarm|intumescent)\w*/i],
  ["Landscaping", /\b(landscap|external works|planting|paving)\w*/i],
  ["Demolition", /\b(demolition|soft strip|structural strip)\w*/i],
  ["Cleaning", /\b(cleaning|site clean|builders clean)\w*/i],
];

/**
 * Best-effort trade inference from a document title (and optionally its text).
 * Returns null when nothing matches, so callers can fall back to "General".
 */
export function inferTradeFromText(...parts: Array<string | null | undefined>): TradePackage | null {
  const haystack = parts.filter(Boolean).join(" \n ");
  if (!haystack.trim()) return null;
  let best: { trade: TradePackage; index: number } | null = null;
  for (const [trade, re] of TRADE_SIGNALS) {
    const m = re.exec(haystack);
    if (m && (best === null || m.index < best.index)) best = { trade, index: m.index };
  }
  return best?.trade ?? null;
}

