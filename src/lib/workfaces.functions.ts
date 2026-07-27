import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertProjectAdmin(supabase: any, projectId: string, userId: string) {
  const { data, error } = await supabase.rpc("is_project_admin", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project admin role required.");
}

export const listWorkfaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        includeArchived: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let query = (context.supabase as any)
      .from("workfaces")
      .select(
        "id, zone_id, package_invite_id, name, stage, source, status, created_at, work_zones(name, level), subcontractor_invites(company_name, package_manager_id)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (!data.includeArchived) {
      query = query.neq("status", "archived");
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Runs the auto-suggestion pass: proposes one workface per active
// zone x accepted package pair that doesn't already have one. Safe to
// call repeatedly — never duplicates an existing non-archived pairing.
export const suggestWorkfaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "suggest_workfaces" as never,
      {
        _project_id: data.projectId,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { created: ((rows ?? []) as unknown[]).length };
  });

async function getWorkfaceProjectId(supabase: any, workfaceId: string): Promise<string> {
  const { data, error } = await supabase
    .from("workfaces")
    .select("project_id")
    .eq("id", workfaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workface not found.");
  return data.project_id as string;
}

export const confirmWorkface = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workfaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("workfaces")
      .update({ status: "confirmed" })
      .eq("id", data.workfaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameWorkface = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        workfaceId: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        stage: z.string().trim().max(60).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("workfaces")
      .update({ name: data.name, stage: data.stage || null })
      .eq("id", data.workfaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Manual creation — for the "manual anytime" case: temporary works,
// remedials, a late design change, an out-of-sequence area, etc.
export const createWorkfaceManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        stage: z.string().trim().max(60).optional().nullable(),
        zoneId: z.string().uuid().optional().nullable(),
        packageInviteId: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("workfaces")
      .insert({
        project_id: data.projectId,
        zone_id: data.zoneId || null,
        package_invite_id: data.packageInviteId || null,
        name: data.name,
        stage: data.stage || null,
        source: "manual",
        status: "confirmed",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// Merge: folds `sourceId` into `targetId` by archiving the source. Data
// migration of any linked activity onto the target workface is deferred
// to the step that wires daily_site_diaries onto workface_id — until
// then this is a safe no-op beyond archiving, since nothing references
// workface_id yet.
export const mergeWorkfaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.sourceId === data.targetId) throw new Error("Cannot merge a workface into itself.");
    const [sourceProjectId, targetProjectId] = await Promise.all([
      getWorkfaceProjectId(context.supabase, data.sourceId),
      getWorkfaceProjectId(context.supabase, data.targetId),
    ]);
    if (sourceProjectId !== targetProjectId) {
      throw new Error("Cannot merge workfaces from different projects.");
    }
    await assertProjectAdmin(context.supabase, sourceProjectId, context.userId);
    const { error } = await (context.supabase as any)
      .from("workfaces")
      .update({ status: "archived" })
      .eq("id", data.sourceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveWorkface = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workfaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const projectId = await getWorkfaceProjectId(context.supabase, data.workfaceId);
    await assertProjectAdmin(context.supabase, projectId, context.userId);
    const { error } = await (context.supabase as any)
      .from("workfaces")
      .update({ status: "archived" })
      .eq("id", data.workfaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
