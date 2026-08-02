/**
 * Server-only storage purge for project deletion.
 *
 * The database cascade removes rows; it cannot remove bucket objects, because
 * that needs the Storage API. This module collects every storage object a
 * project owns and removes it best-effort: a failure on one bucket is logged
 * and skipped, never allowed to block the project delete.
 *
 * Deliberately NOT purged:
 *  - `snag-photos` — `snags.project_id` is ON DELETE SET NULL, so snags (and
 *    their photos) survive the project by design.
 *  - `guide-narration` — global onboarding audio, not project-owned.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PurgeResult = {
  /** bucket -> number of objects successfully requested for removal */
  removed: Record<string, number>;
  errors: string[];
};

/** Normalise a stored value that may be a bare key or a full/public URL. */
function toKey(bucket: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  const marker = `/${bucket}/`;
  const idx = v.indexOf(marker);
  if (idx >= 0) return v.slice(idx + marker.length).replace(/^\/+/, "");
  if (/^https?:\/\//i.test(v)) return null; // foreign URL, not our object
  return v.replace(/^\/+/, "");
}

export async function purgeProjectStorage(projectId: string): Promise<PurgeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: PurgeResult = { removed: {}, errors: [] };
  const byBucket = new Map<string, Set<string>>();

  const add = (bucket: string, value: string | null | undefined) => {
    const key = toKey(bucket, value);
    if (!key) return;
    if (!byBucket.has(bucket)) byBucket.set(bucket, new Set());
    byBucket.get(bucket)!.add(key);
  };

  const safe = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err: any) {
      result.errors.push(`${label}: ${err?.message ?? String(err)}`);
    }
  };

  // 1. site_documents behind drawings / logistics plans / RAMS / bible reports
  await safe("site_documents", async () => {
    const tables = [
      "project_drawings",
      "logistics_plans",
      "rams_documents",
      "project_bible_reports",
    ] as const;
    const docIds = new Set<string>();
    for (const t of tables) {
      const { data, error } = await (supabaseAdmin as any)
        .from(t)
        .select("site_document_id")
        .eq("project_id", projectId);
      if (error) throw new Error(`${t}: ${error.message}`);
      for (const r of data ?? []) if (r.site_document_id) docIds.add(r.site_document_id);
    }
    if (docIds.size === 0) return;
    const ids = Array.from(docIds);
    const chunk = 200;
    for (let i = 0; i < ids.length; i += chunk) {
      const { data, error } = await (supabaseAdmin as any)
        .from("site_documents")
        .select("bucket, file_path")
        .in("id", ids.slice(i, i + chunk));
      if (error) throw new Error(error.message);
      for (const d of data ?? []) add(d.bucket || "project-bible", d.file_path);
    }
  });

  // 2. diary photos (subcontractor + manager evidence)
  await safe("diary-photos", async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("daily_site_diaries")
      .select("photo_urls, manager_photo_urls")
      .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    for (const d of data ?? []) {
      for (const p of [...(d.photo_urls ?? []), ...(d.manager_photo_urls ?? [])]) {
        add("diary-photos", p);
      }
    }
  });

  // 3. programme uploads
  await safe("programme-uploads", async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("programme_uploads")
      .select("storage_path")
      .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) add("programme-uploads", r.storage_path);
  });

  // 4. BIM / IFC models
  await safe("project-bim-models", async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("project_ifc_models")
      .select("storage_path")
      .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) add("project-bim-models", r.storage_path);
  });

  // 5. archived weekly subcontractor packs
  await safe("subcontractor-packs", async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("subcontractor_pack_issues")
      .select("storage_path")
      .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) add("subcontractor-packs", r.storage_path);
  });

  // 6. compliance docs uploaded against this project's subcontractors
  await safe("compliance-docs", async () => {
    const { data: subs, error: subErr } = await (supabaseAdmin as any)
      .from("subcontractors")
      .select("id")
      .eq("project_id", projectId);
    if (subErr) throw new Error(subErr.message);
    const subIds = (subs ?? []).map((s: any) => s.id);
    if (subIds.length === 0) return;

    const sources: Array<[string, string]> = [
      ["workers", "competency_card_url"],
      ["registers", "certificate_url"],
      ["toolbox_talks", "attachment_url"],
    ];
    for (const [table, column] of sources) {
      const { data, error } = await (supabaseAdmin as any)
        .from(table)
        .select(column)
        .in("subcontractor_id", subIds);
      if (error) throw new Error(`${table}: ${error.message}`);
      for (const r of data ?? []) add("compliance-docs", r[column]);
    }
  });

  // Remove, bucket by bucket, in batches. Failures are recorded, never thrown.
  for (const [bucket, keys] of byBucket) {
    const list = Array.from(keys);
    const chunk = 100;
    for (let i = 0; i < list.length; i += chunk) {
      const slice = list.slice(i, i + chunk);
      try {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(slice);
        if (error) {
          result.errors.push(`remove ${bucket}: ${error.message}`);
        } else {
          result.removed[bucket] = (result.removed[bucket] ?? 0) + slice.length;
        }
      } catch (err: any) {
        result.errors.push(`remove ${bucket}: ${err?.message ?? String(err)}`);
      }
    }
  }

  if (result.errors.length) {
    console.error(`[purgeProjectStorage] project ${projectId} partial failures`, result.errors);
  }
  return result;
}
