/**
 * Shared normalisation for AI-extracted work zones.
 *
 * Two problems this fixes, both seen on real ingests:
 *  1. The model returns the zone *code* only ("Zone A") and parks the
 *     descriptive part in `description` — so the DABS dropdown showed five
 *     identical "Zone A" entries with no way to tell floors apart.
 *  2. Levels came back in mixed formats ("Level 00", "01", "Ground") across
 *     sheets of the same pack.
 */

/** Zone label that is nothing but a code, e.g. "Zone A", "Zone B1", "A". */
const BARE_CODE = /^(?:zone\s*)?[a-z]\d?$/i;

/** Normalises a level to a consistent "Level NN" / named-level format. */
export function normaliseLevel(raw?: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (/^(ground|gf|ground floor|level ground)$/.test(lower)) return "Level 00";
  if (/^(roof|roof level)$/.test(lower)) return "Roof";
  if (/^(basement|bf|lower ground|lg)$/.test(lower)) return "Basement";
  const m = lower.match(/^(?:level|lvl|l|floor|fl)?\s*[-–]?\s*(\d{1,2})$/);
  if (m) return `Level ${m[1]!.padStart(2, "0")}`;
  return v.replace(/\s{2,}/g, " ");
}

/**
 * Rebuilds the full descriptive zone name when the model split the code away
 * from its description. "Zone A" + "Open Plan Office" → "Zone A - Open Plan
 * Office". Leaves already-descriptive names untouched.
 */
export function fullZoneName(name?: string | null, description?: string | null): string {
  const n = (name ?? "").trim().replace(/\s{2,}/g, " ");
  const d = (description ?? "").trim().replace(/\s{2,}/g, " ");
  if (!n) return d;
  if (!d) return n;
  if (n.toLowerCase().includes(d.toLowerCase())) return n;
  if (BARE_CODE.test(n)) return `${n} - ${d}`;
  return n;
}

/** Instruction fragment reused by every zone-extraction prompt. */
export const ZONE_NAME_RULE =
  'The "name" MUST be the complete label exactly as printed on the sheet, ' +
  'including any descriptive suffix — e.g. "Zone A - Open Plan Office", not "Zone A". ' +
  'Never shorten a zone to just its letter or number code. ' +
  'Format "level" consistently as "Level 00", "Level 01" … (two digits), or null when the zone is not on a floor.';
