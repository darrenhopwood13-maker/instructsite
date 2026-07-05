import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const projectIdInput = z.object({ projectId: z.string().uuid() });

// Randall AI semantic zone patterns
const ZONE_PATTERNS: Array<{ match: RegExp; keys: string[] }> = [
  { match: /\b(kit|kitch|kitchen|sink|cabinet|appliance|worktop|hob|oven)\b/i, keys: ["kitchen"] },
  { match: /\b(bath|bathroom|wc|shower|toilet|basin|ensuite|en[- ]?suite|lavatory)\b/i, keys: ["bathroom", "bath", "wc"] },
  { match: /\b(beam|column|uc\d*|ub\d*|baseplate|steelwork|rsj|purlin|structural steel)\b/i, keys: ["structural steel", "steel", "structure"] },
];

export const autoAllocateModelElements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        elements: z
          .array(
            z.object({
              globalId: z.string().min(1).max(64),
              text: z.string().max(1000),
            }),
          )
          .max(20000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: model, error: mErr } = await context.supabase
      .from("project_ifc_models")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("is_active", true)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!model) throw new Error("No active IFC model for this project");

    const { data: zones, error: zErr } = await context.supabase
      .from("work_zones")
      .select("id, name")
      .eq("project_id", data.projectId);
    if (zErr) throw new Error(zErr.message);
    if (!zones || zones.length === 0) {
      return { ok: false as const, count: 0, reason: "No work zones defined" };
    }

    const findZone = (candidates: string[]) => {
      for (const c of candidates) {
        const z = zones.find((z) => z.name.toLowerCase().includes(c.toLowerCase()));
        if (z) return z.id;
      }
      return null;
    };

    const rows: Array<{ model_id: string; global_id: string; zone_id: string }> = [];
    for (const el of data.elements) {
      for (const pat of ZONE_PATTERNS) {
        if (pat.match.test(el.text)) {
          const zoneId = findZone(pat.keys);
          if (zoneId) rows.push({ model_id: model.id, global_id: el.globalId, zone_id: zoneId });
          break;
        }
      }
    }

    if (rows.length === 0) {
      return { ok: true as const, count: 0, reason: "No semantic matches found" };
    }
    const { error } = await context.supabase
      .from("ifc_element_mappings")
      .upsert(rows, { onConflict: "model_id,global_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const, count: rows.length };
  });

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
    const [zonesRes, progressRes, liveRes] = await Promise.all([
      context.supabase.from("work_zones").select("id, name, level").eq("project_id", data.projectId),
      context.supabase.rpc("zone_approved_completion", { _project_id: data.projectId }),
      context.supabase
        .from("live_site_activity")
        .select("zone_id")
        .eq("project_id", data.projectId)
        .eq("status", "active"),
    ]);
    if (zonesRes.error) throw new Error(zonesRes.error.message);
    if (progressRes.error) throw new Error(progressRes.error.message);
    if (liveRes.error) throw new Error(liveRes.error.message);

    const progressByZone = new Map<string, number>();
    for (const row of (progressRes.data ?? []) as Array<{
      zone_id: string;
      total_pct: number | string;
    }>) {
      progressByZone.set(row.zone_id, Number(row.total_pct) || 0);
    }
    const live = new Set(
      (liveRes.data ?? []).map((r) => r.zone_id).filter(Boolean) as string[],
    );

    return (zonesRes.data ?? []).map((z) => {
      const progress_pct = Math.min(100, Math.round(progressByZone.get(z.id) ?? 0));
      const state: "complete" | "live" | "unstarted" =
        progress_pct >= 100
          ? "complete"
          : live.has(z.id)
            ? "live"
            : "unstarted";
      return {
        zone_id: z.id,
        name: z.name,
        level: z.level,
        state,
        progress_pct,
      };
    });
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
