import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureProjectMember(supabase: any, userId: string, projectId: string) {
  const { data, error } = await supabase.rpc("is_project_member", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You don't have access to this project.");
}

/**
 * Look up any non-archived documents in this project whose content_hash
 * matches. Returns lightweight refs so the client can offer
 * "replace as new revision" vs "upload as separate document".
 */
export const findDuplicateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        contentHash: z.string().min(32).max(128),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectMember(supabase, userId, data.projectId);

    // Pull site_document_ids the project can see across the tier tables.
    const [dr, lg, rm, rp] = await Promise.all([
      supabase.from("project_drawings").select("site_document_id").eq("project_id", data.projectId),
      supabase.from("logistics_plans").select("site_document_id").eq("project_id", data.projectId),
      supabase.from("rams_documents").select("site_document_id").eq("project_id", data.projectId),
      supabase.from("project_bible_reports").select("site_document_id").eq("project_id", data.projectId),
    ]);
    const ids = new Set<string>();
    for (const r of [dr, lg, rm, rp]) {
      for (const row of (r.data ?? []) as any[]) if (row?.site_document_id) ids.add(row.site_document_id);
    }
    if (ids.size === 0) return { matches: [] as Array<{ id: string; fileName: string; createdAt: string | null }> };

    const { data: rows, error } = await supabase
      .from("site_documents")
      .select("id, file_name, created_at, archived_at, content_hash")
      .in("id", Array.from(ids))
      .eq("content_hash", data.contentHash)
      .is("archived_at", null);
    if (error) return { matches: [] };
    return {
      matches: ((rows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        fileName: r.file_name as string,
        createdAt: r.created_at as string | null,
      })),
    };
  });

/**
 * Soft-delete a document (archive). Preserves the row + storage object.
 */
export const archiveDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        siteDocumentId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("site_documents")
      .update({ archived_at: new Date().toISOString(), archived_by: userId })
      .eq("id", data.siteDocumentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Restore a soft-deleted document.
 */
export const restoreDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ siteDocumentId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("site_documents")
      .update({ archived_at: null, archived_by: null })
      .eq("id", data.siteDocumentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Mark oldSiteDocumentId as superseded by newSiteDocumentId and
 * archive it in one shot.
 */
export const supersedeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        oldSiteDocumentId: z.string().uuid(),
        newSiteDocumentId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("site_documents")
      .update({
        superseded_by: data.newSiteDocumentId,
        archived_at: now,
        archived_by: userId,
      })
      .eq("id", data.oldSiteDocumentId);
    if (upErr) throw new Error(upErr.message);

    const { error: revErr } = await supabase
      .from("site_documents")
      .update({ revision_of: data.oldSiteDocumentId })
      .eq("id", data.newSiteDocumentId);
    if (revErr) throw new Error(revErr.message);
    return { ok: true };
  });
