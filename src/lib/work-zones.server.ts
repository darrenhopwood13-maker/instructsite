/**
 * Work-zone persistence helper.
 *
 * Why this exists instead of a plain PostgREST upsert:
 *  - `work_zones.level` is nullable, and in Postgres NULL never conflicts, so
 *    `ON CONFLICT (project_id, name, level)` silently fails to dedupe every
 *    site-wide zone (compound, laydown, pedestrian route) that has no level.
 *  - Inference against that constraint also blew up in production with
 *    "there is no unique or exclusion constraint matching the ON CONFLICT
 *    specification", which killed the whole logistics link step.
 *
 * So we read what is already there and insert only what is genuinely new.
 */

export type ZoneRow = {
  project_id: string;
  name: string;
  level: string | null;
  source: string;
  status: string;
  drawing_id?: string | null;
  logistics_plan_id?: string | null;
};

const key = (name: string, level: string | null | undefined) =>
  `${name.trim().toLowerCase()}|${(level ?? "").trim().toLowerCase()}`;

export async function insertMissingZones(
  supabase: any,
  projectId: string,
  rows: ZoneRow[],
): Promise<{ inserted: number; skipped: number; error: string | null }> {
  const wanted = new Map<string, ZoneRow>();
  for (const r of rows) {
    const name = (r.name ?? "").trim();
    if (!name) continue;
    wanted.set(key(name, r.level), { ...r, name });
  }
  if (wanted.size === 0) return { inserted: 0, skipped: 0, error: null };

  const { data: existing, error: readErr } = await supabase
    .from("work_zones")
    .select("id,name,level")
    .eq("project_id", projectId);
  if (readErr) return { inserted: 0, skipped: 0, error: readErr.message };

  // A site-wide zone (compound, laydown, pedestrian route) is stored once with
  // no level. Drawing allocation defaults a missing level to the sheet's level,
  // which would otherwise clone those zones onto every floor.
  const siteWide = new Set(
    (existing ?? [])
      .filter((e: any) => !(e.level ?? "").trim())
      .map((e: any) => e.name.trim().toLowerCase()),
  );
  for (const e of existing ?? []) wanted.delete(key(e.name, e.level));
  for (const k of [...wanted.keys()]) {
    if (siteWide.has(k.split("|")[0]!)) wanted.delete(k);
  }
  const toInsert = [...wanted.values()];
  const skipped = rows.length - toInsert.length;
  if (toInsert.length === 0) return { inserted: 0, skipped, error: null };

  const { error: insErr } = await supabase.from("work_zones").insert(toInsert);
  if (insErr) {
    console.error("[work-zones] insert failed", {
      projectId,
      attempted: toInsert.length,
      code: insErr.code,
      details: insErr.details,
      message: insErr.message,
    });
    return { inserted: 0, skipped, error: insErr.message };
  }
  return { inserted: toInsert.length, skipped, error: null };
}
