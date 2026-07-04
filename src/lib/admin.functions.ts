import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMasterAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "master_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Master Admin role required.");
}

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        confirmName: z.string().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context.supabase, context.userId);
    const { data: project, error: getErr } = await context.supabase
      .from("projects")
      .select("id,name")
      .eq("id", data.projectId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!project) throw new Error("Project not found.");
    if (project.name.trim() !== data.confirmName.trim()) {
      throw new Error("Project name confirmation does not match.");
    }
    const { error } = await context.supabase
      .from("projects")
      .delete()
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDrawing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ drawingId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context.supabase, context.userId);
    // Fetch to locate source document for cascade
    const { data: drawing, error: getErr } = await context.supabase
      .from("project_drawings")
      .select("id,site_document_id")
      .eq("id", data.drawingId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!drawing) throw new Error("Drawing not found.");

    // Delete the underlying site_document; cascades to project_drawings via FK
    if (drawing.site_document_id) {
      const { error: sdErr } = await context.supabase
        .from("site_documents")
        .delete()
        .eq("id", drawing.site_document_id);
      if (sdErr) throw new Error(sdErr.message);
    } else {
      const { error } = await context.supabase
        .from("project_drawings")
        .delete()
        .eq("id", data.drawingId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const createWorkZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        level: z.string().trim().max(60).optional().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("work_zones")
      .insert({
        project_id: data.projectId,
        name: data.name,
        level: data.level || null,
        source: "manual",
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setWorkZoneStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        zoneId: z.string().uuid(),
        status: z.enum(["active", "closed"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("work_zones")
      .update({ status: data.status })
      .eq("id", data.zoneId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
