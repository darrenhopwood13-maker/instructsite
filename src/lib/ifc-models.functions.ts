import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const projectIdInput = z.object({ projectId: z.string().uuid() });

// Randall AI semantic zone patterns — matched top-to-bottom, first hit wins.
// `keys` are substrings Randall searches for in zone names (case-insensitive).
const ZONE_PATTERNS: Array<{ label: string; match: RegExp; keys: string[] }> = [
  // --- Rooms / spaces ---
  { label: "kitchen", match: /\b(kit|kitch|kitchen|sink|cabinet|appliance|worktop|hob|oven|pantry|utility)\b/i, keys: ["kitchen", "utility", "pantry"] },
  { label: "bathroom", match: /\b(bath|bathroom|wc|shower|toilet|basin|ensuite|en[- ]?suite|lavatory|washroom)\b/i, keys: ["bathroom", "bath", "wc", "en-suite", "ensuite"] },
  { label: "bedroom", match: /\b(bed|bedroom|master|guest\s*room)\b/i, keys: ["bedroom", "bed"] },
  { label: "living", match: /\b(living|lounge|reception|family\s*room|snug)\b/i, keys: ["living", "lounge", "reception"] },
  { label: "dining", match: /\b(dining|diner)\b/i, keys: ["dining"] },
  { label: "hallway", match: /\b(hall|hallway|corridor|passage|lobby|foyer|entrance)\b/i, keys: ["hall", "corridor", "lobby"] },
  { label: "stairs", match: /\b(stair|staircase|stairwell|landing)\b/i, keys: ["stair", "landing"] },
  { label: "office", match: /\b(office|study|workspace|meeting|boardroom)\b/i, keys: ["office", "study", "meeting"] },
  { label: "garage", match: /\b(garage|car\s*port|carport)\b/i, keys: ["garage", "carport"] },
  { label: "plant", match: /\b(plant\s*room|riser|mech(anical)?\s*room|boiler|comms|server\s*room)\b/i, keys: ["plant", "mechanical", "boiler", "comms"] },
  { label: "external", match: /\b(external|garden|patio|terrace|balcony|roof\s*terrace)\b/i, keys: ["external", "garden", "terrace", "balcony"] },

  // --- Structural / envelope ---
  { label: "structural steel", match: /\b(beam|column|uc\d*|ub\d*|baseplate|steelwork|rsj|purlin|structural\s*steel|steel\s*frame)\b/i, keys: ["structural steel", "steel", "structure", "frame"] },
  { label: "concrete", match: /\b(slab|deck|footing|foundation|pile|pad|raft|screed|blinding)\b/i, keys: ["concrete", "slab", "foundation", "substructure"] },
  { label: "roof", match: /\b(roof|rafter|truss|ridge|eaves|gutter|fascia|soffit)\b/i, keys: ["roof"] },
  { label: "facade", match: /\b(facade|cladding|curtain\s*wall|rainscreen|render|brickwork|blockwork|masonry)\b/i, keys: ["facade", "cladding", "envelope"] },
  { label: "windows", match: /\b(window|glazing|glazed|fenestration)\b/i, keys: ["window", "glazing", "fenestration"] },
  { label: "doors", match: /\b(door|doorset|ironmongery)\b/i, keys: ["door"] },

  // --- MEP ---
  { label: "mechanical", match: /\b(hvac|ahu|fcu|duct|ductwork|ventilation|extract|supply\s*air|chiller|heat\s*pump|radiator|underfloor\s*heating|ufh)\b/i, keys: ["mechanical", "hvac", "mep"] },
  { label: "electrical", match: /\b(cable|containment|tray|basket|conduit|switchgear|distribution\s*board|db-|luminaire|lighting|socket|small\s*power)\b/i, keys: ["electrical", "power", "lighting", "mep"] },
  { label: "plumbing", match: /\b(pipe|pipework|drainage|soil|waste|hot\s*water|cold\s*water|sprinkler|riser)\b/i, keys: ["plumbing", "drainage", "mep"] },
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
    const missedLabels = new Set<string>();
    let inspected = 0;
    let matchedPattern = 0;
    for (const el of data.elements) {
      inspected++;
      for (const pat of ZONE_PATTERNS) {
        if (pat.match.test(el.text)) {
          matchedPattern++;
          const zoneId = findZone(pat.keys);
          if (zoneId) {
            rows.push({ model_id: model.id, global_id: el.globalId, zone_id: zoneId });
          } else {
            missedLabels.add(pat.label);
          }
          break;
        }
      }
    }

    if (rows.length === 0) {
      const reason =
        matchedPattern === 0
          ? `No semantic matches in ${inspected} elements. Element names don't hint at rooms/trades.`
          : `Matched ${matchedPattern} elements (${Array.from(missedLabels).join(", ")}) but no zone names contain those keywords. Rename zones e.g. "Kitchen", "Bathroom", "Structural Steel".`;
      return { ok: true as const, count: 0, reason };
    }
    const { error } = await context.supabase
      .from("ifc_element_mappings")
      .upsert(rows, { onConflict: "model_id,global_id" });
    if (error) throw new Error(error.message);
    const suffix = missedLabels.size > 0
      ? ` (skipped: ${Array.from(missedLabels).join(", ")} — no matching zone)`
      : "";
    return { ok: true as const, count: rows.length, reason: `Allocated ${rows.length} of ${inspected}${suffix}` };
  });
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
