import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const projectIdInput = z.object({ projectId: z.string().uuid() });

export const listIfcModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => projectIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_ifc_models")
      .select("id, project_id, storage_path, original_filename, is_active, created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getActiveIfcSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => projectIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: model, error } = await context.supabase
      .from("project_ifc_models")
      .select("id, storage_path, original_filename, created_at")
      .eq("project_id", data.projectId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!model) return { model: null, url: null } as const;

    const { data: signed, error: sErr } = await context.supabase.storage
      .from("project-bim-models")
      .createSignedUrl(model.storage_path, 3600);
    if (sErr) throw new Error(sErr.message);
    return { model, url: signed.signedUrl } as const;
  });

export const registerIfcModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        storagePath: z.string().min(1).max(500),
        filename: z.string().min(1).max(255),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Deactivate existing
    const { error: deErr } = await context.supabase
      .from("project_ifc_models")
      .update({ is_active: false })
      .eq("project_id", data.projectId)
      .eq("is_active", true);
    if (deErr) throw new Error(deErr.message);

    const { data: row, error } = await context.supabase
      .from("project_ifc_models")
      .insert({
        project_id: data.projectId,
        storage_path: data.storagePath,
        original_filename: data.filename,
        uploaded_by: context.userId,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listElementMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => projectIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: model } = await context.supabase
      .from("project_ifc_models")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("is_active", true)
      .maybeSingle();
    if (!model) return [] as Array<{ global_id: string; zone_id: string }>;

    const { data: rows, error } = await context.supabase
      .from("ifc_element_mappings")
      .select("global_id, zone_id")
      .eq("model_id", model.id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertElementMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        modelId: z.string().uuid(),
        rows: z
          .array(
            z.object({
              global_id: z.string().min(1).max(64),
              zone_id: z.string().uuid(),
            }),
          )
          .max(5000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.rows.length === 0) return { ok: true, count: 0 };
    const payload = data.rows.map((r) => ({
      model_id: data.modelId,
      global_id: r.global_id,
      zone_id: r.zone_id,
    }));
    const { error } = await context.supabase
      .from("ifc_element_mappings")
      .upsert(payload, { onConflict: "model_id,global_id" });
    if (error) throw new Error(error.message);
    return { ok: true, count: payload.length };
  });

export const listZoneRuntimeState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => projectIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const [zonesRes, diariesRes, liveRes] = await Promise.all([
      context.supabase.from("work_zones").select("id, name, level").eq("project_id", data.projectId),
      context.supabase
        .from("daily_site_diaries")
        .select("zone_id, ifc_synced")
        .eq("project_id", data.projectId)
        .eq("ifc_synced", true),
      context.supabase
        .from("live_site_activity")
        .select("zone_id")
        .eq("project_id", data.projectId)
        .eq("status", "active"),
    ]);
    if (zonesRes.error) throw new Error(zonesRes.error.message);
    if (diariesRes.error) throw new Error(diariesRes.error.message);
    if (liveRes.error) throw new Error(liveRes.error.message);

    const complete = new Set(
      (diariesRes.data ?? []).map((r) => r.zone_id).filter(Boolean) as string[],
    );
    const live = new Set(
      (liveRes.data ?? []).map((r) => r.zone_id).filter(Boolean) as string[],
    );

    return (zonesRes.data ?? []).map((z) => ({
      zone_id: z.id,
      name: z.name,
      level: z.level,
      state: complete.has(z.id)
        ? ("complete" as const)
        : live.has(z.id)
          ? ("live" as const)
          : ("unstarted" as const),
    }));
  });

export const listProjectZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => projectIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("work_zones")
      .select("id, name, level")
      .eq("project_id", data.projectId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
