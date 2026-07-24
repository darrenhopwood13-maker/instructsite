// Deterministic colour derivation for site labor pins.
// A single key (trade package or subcontractor id/company) always maps to
// the same palette entry, so pins, list rows and cockpit chips stay in sync.

export type PinPalette = {
  key: string;
  hex: string;        // solid marker fill
  ring: string;       // outer ring / halo tint
  soft: string;       // translucent surface tint
  text: string;       // on-solid text colour
  label: string;      // hex-only string for style="color:..."
};

// Curated 12-hue palette — high contrast on dark backgrounds, colour-blind aware.
const PALETTE: Array<{ hex: string; ring: string; soft: string; text: string }> = [
  { hex: "#F97316", ring: "rgba(249,115,22,0.55)",  soft: "rgba(249,115,22,0.14)",  text: "#0B0B0B" }, // orange
  { hex: "#22D3EE", ring: "rgba(34,211,238,0.55)",  soft: "rgba(34,211,238,0.14)",  text: "#0B0B0B" }, // cyan
  { hex: "#A78BFA", ring: "rgba(167,139,250,0.55)", soft: "rgba(167,139,250,0.14)", text: "#0B0B0B" }, // violet
  { hex: "#34D399", ring: "rgba(52,211,153,0.55)",  soft: "rgba(52,211,153,0.14)",  text: "#0B0B0B" }, // emerald
  { hex: "#F472B6", ring: "rgba(244,114,182,0.55)", soft: "rgba(244,114,182,0.14)", text: "#0B0B0B" }, // pink
  { hex: "#FACC15", ring: "rgba(250,204,21,0.55)",  soft: "rgba(250,204,21,0.14)",  text: "#0B0B0B" }, // yellow
  { hex: "#60A5FA", ring: "rgba(96,165,250,0.55)",  soft: "rgba(96,165,250,0.14)",  text: "#0B0B0B" }, // sky
  { hex: "#F87171", ring: "rgba(248,113,113,0.55)", soft: "rgba(248,113,113,0.14)", text: "#0B0B0B" }, // red
  { hex: "#4ADE80", ring: "rgba(74,222,128,0.55)",  soft: "rgba(74,222,128,0.14)",  text: "#0B0B0B" }, // green
  { hex: "#C084FC", ring: "rgba(192,132,252,0.55)", soft: "rgba(192,132,252,0.14)", text: "#0B0B0B" }, // fuchsia
  { hex: "#FB923C", ring: "rgba(251,146,60,0.55)",  soft: "rgba(251,146,60,0.14)",  text: "#0B0B0B" }, // amber-orange
  { hex: "#2DD4BF", ring: "rgba(45,212,191,0.55)",  soft: "rgba(45,212,191,0.14)",  text: "#0B0B0B" }, // teal
];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pinColor(rawKey?: string | null): PinPalette {
  const key = (rawKey ?? "").trim().toLowerCase() || "untagged";
  const entry = PALETTE[hash(key) % PALETTE.length];
  return { key, hex: entry.hex, ring: entry.ring, soft: entry.soft, text: entry.text, label: entry.hex };
}

// Given a live pin row, pick the best key: trade package first (so all
// electricians share a colour), fall back to subcontractor id/company.
export function pinKey(pin: {
  trade_package?: string | null;
  subcontractor_id?: string | null;
  company_name?: string | null;
}): string {
  return (
    pin.trade_package?.trim() ||
    pin.company_name?.trim() ||
    pin.subcontractor_id ||
    "untagged"
  );
}
