import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canonicalizeTrade, inferTradeFromText, GENERAL_TRADE } from "@/lib/trade-packages";


const DOC_TYPES = ["drawing", "logistics", "rams"] as const;
type DocType = (typeof DOC_TYPES)[number];

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function downloadDocText(supabase: any, siteDocumentId: string): Promise<string> {
  const { data: doc, error } = await supabase
    .from("site_documents")
    .select("file_path,bucket,mime_type")
    .eq("id", siteDocumentId)
    .maybeSingle();
  if (error || !doc) throw new Error("Source document missing");
  const { data: blob, error: dlErr } = await supabase.storage
    .from(doc.bucket ?? "project-bible")
    .download(doc.file_path);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Download failed");
  const mime = (doc.mime_type ?? "").toLowerCase();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (mime.includes("pdf")) return extractPdfText(bytes);
  if (mime.startsWith("text/")) return new TextDecoder().decode(bytes);
  return "";
}

async function aiJson<T>(prompt: string, sample: string): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-2.5-flash");
  const { text } = await generateText({
    model,
    system:
      "You are a construction drawing metadata extractor. Respond ONLY with valid JSON. No prose, no markdown fences.",
    prompt: `${prompt}\n\n---DOCUMENT TEXT (may be truncated)---\n${sample.slice(0, 12000)}`,
  });
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Extract first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI did not return valid JSON");
  }
}

async function ensureProjectAccess(
  supabase: any,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("is_project_member", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (data) return;

  // Oracle sessions are anonymous — auto-enroll the current session as a
  // viewer via the service-role client (project_members RLS blocks self-insert).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: insertErr } = await supabaseAdmin
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role_on_project: "subcontractor" });
  if (insertErr && !/duplicate|unique/i.test(insertErr.message ?? "")) {
    throw new Error("You are not a member of this project.");
  }
}



/**
 * Registers a Tier-1 operational document (drawing / logistics / RAMS)
 * that has already been uploaded to the `project-bible` bucket.
 * Creates site_documents + the specialized row, then triggers AI extraction.
 */
export const registerTier1Document = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        docType: z.enum(DOC_TYPES),
        fileName: z.string().min(1),
        filePath: z.string().min(1),
        fileSize: z.number().nonnegative(),
        mimeType: z.string().min(1),
        tradePackage: z.string().optional(),
        highRiskFlags: z.array(z.enum(["working_at_height", "hot_works", "confined_space"])).optional(),
        permitRequired: z.boolean().optional(),
        contentHash: z.string().min(32).max(128).optional(),
        supersedesSiteDocumentId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectAccess(supabase, userId, data.projectId);

    if (!data.filePath.startsWith(`${userId}/`)) {
      throw new Error("Upload path must be under the signed-in user's folder.");
    }

    // 1) site_documents row
    const { data: sd, error: sdErr } = await supabase
      .from("site_documents")
      .insert({
        file_name: data.fileName,
        file_path: data.filePath,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        bucket: "project-bible",
        uploaded_by: userId,
        extraction_status: "processing",
        content_hash: data.contentHash ?? null,
        revision_of: data.supersedesSiteDocumentId ?? null,
      } as any)
      .select("id")
      .single();
    if (sdErr) throw new Error(sdErr.message);

    // Supersede + soft-archive the prior revision (best-effort).
    if (data.supersedesSiteDocumentId) {
      await supabase
        .from("site_documents")
        .update({
          superseded_by: sd.id,
          archived_at: new Date().toISOString(),
          archived_by: userId,
        } as any)
        .eq("id", data.supersedesSiteDocumentId);
    }

    // 2) specialized row
    if (data.docType === "drawing") {
      await supabase.from("project_drawings").insert({
        project_id: data.projectId,
        site_document_id: sd.id,
        extraction_status: "processing",
      });
    } else if (data.docType === "logistics") {
      await supabase.from("logistics_plans").insert({
        project_id: data.projectId,
        site_document_id: sd.id,
        extraction_status: "processing",
      });
    } else {
      await supabase.from("rams_documents").insert({
        project_id: data.projectId,
        site_document_id: sd.id,
        uploaded_by: userId,
        trade_package: data.tradePackage ?? "General",
        high_risk_flags: data.highRiskFlags ?? [],
        permit_required: data.permitRequired ?? (data.highRiskFlags?.length ?? 0) > 0,
      });
    }

    // 3) extraction (best-effort)
    let extractionStatus: "complete" | "empty" | "failed" = "empty";
    let extractionError: string | null = null;
    const mime = (data.mimeType ?? "").toLowerCase();
    const isImage = mime.startsWith("image/");
    try {
      // Site logistics plans uploaded as raster images (PNG/JPEG/HEIC) can't be
      // text-parsed. Surface a clear, actionable error instead of silently
      // leaving the row in "processing" forever.
      if (data.docType === "logistics" && isImage) {
        throw new Error(
          "Image-format site plans can't be text-parsed. Re-upload the logistics plan as a PDF, or add work zones manually from the DABS panel.",
        );
      }

      const rawText = await downloadDocText(supabase, sd.id);
      if (!rawText || rawText.trim().length < 20) {
        extractionStatus = "empty";
        if (data.docType === "logistics") {
          // Don't leave the specialized row stuck on "processing".
          await supabase
            .from("logistics_plans")
            .update({
              extraction_status: "empty",
              extraction_error:
                "No readable text found in the uploaded plan. Re-upload a text-based PDF, or add work zones manually.",
            })
            .eq("site_document_id", sd.id);
        } else if (data.docType === "drawing") {
          await supabase
            .from("project_drawings")
            .update({ extraction_status: "empty" })
            .eq("site_document_id", sd.id);
        }
      } else if (data.docType === "drawing") {
        const meta = await aiJson<{
          drawing_no?: string;
          revision?: string;
          title?: string;
          scale?: string;
          level?: string;
          zone?: string;
          zones?: { name: string; level?: string }[];
        }>(
          'Extract the title-block metadata from this GA / architectural drawing. Return JSON with keys: drawing_no, revision, title, scale, level, zone, zones (array of {name, level}). Use null when a value is not present. Do NOT invent values.',
          rawText,
        );
        await supabase
          .from("project_drawings")
          .update({
            drawing_no: meta.drawing_no ?? null,
            revision: meta.revision ?? null,
            title: meta.title ?? null,
            scale: meta.scale ?? null,
            level: meta.level ?? null,
            zone: meta.zone ?? null,
            extraction_status: "complete",
          })
          .eq("site_document_id", sd.id);
        // Work zones are no longer auto-created on upload — Oracle allocates
        // them when the drawing is explicitly added to DABS.

        extractionStatus = "complete";
      } else if (data.docType === "logistics") {
        const meta = await aiJson<{
          zones: { name: string; level?: string; description?: string }[];
        }>(
          'Extract the work zones / site areas / levels described in this Site Logistics Plan. Return JSON: { "zones": [{ "name": string, "level"?: string, "description"?: string }] }.',
          rawText,
        );
        const zones = Array.isArray(meta.zones) ? meta.zones : [];
        await supabase
          .from("logistics_plans")
          .update({
            extracted_zones: zones,
            extraction_status: "complete",
            extraction_error: null,
          })
          .eq("site_document_id", sd.id);

        // Persist the zones into work_zones so DABS can immediately pick a
        // location without waiting for a manager to hand-key them. Uses
        // source='logistics' so downstream views can distinguish these from
        // Oracle-allocated zones. Deduped by (project_id, name, level, source).
        if (zones.length > 0) {
          const seen = new Set<string>();
          const rows = zones
            .map((z) => ({
              project_id: data.projectId,
              name: (z?.name ?? "").trim(),
              level: z?.level?.trim() || null,
              source: "logistics" as const,
              status: "active" as const,
            }))
            .filter((r) => {
              if (!r.name) return false;
              const k = `${r.name.toLowerCase()}|${(r.level ?? "").toLowerCase()}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
          if (rows.length > 0) {
            // Best-effort — a partial failure here shouldn't fail the whole
            // logistics extraction, since the raw zones are already saved on
            // logistics_plans.extracted_zones for manual reconciliation.
            const { error: zErr } = await (supabase as any)
              .from("work_zones")
              .upsert(rows, { onConflict: "project_id,name,level,source", ignoreDuplicates: true });
            if (zErr) {
              extractionError = `Zones extracted but not all could be saved: ${zErr.message}`;
            }
          }
        }

        extractionStatus = "complete";
      } else {
        extractionStatus = "complete";
      }
      await supabase
        .from("site_documents")
        .update({ extraction_status: extractionStatus, extraction_error: extractionError })
        .eq("id", sd.id);
    } catch (err) {
      extractionError = err instanceof Error ? err.message : "Extraction failed";
      extractionStatus = "failed";
      await supabase
        .from("site_documents")
        .update({ extraction_status: "failed", extraction_error: extractionError })
        .eq("id", sd.id);
      if (data.docType === "drawing") {
        await supabase
          .from("project_drawings")
          .update({ extraction_status: "failed", extraction_error: extractionError })
          .eq("site_document_id", sd.id);
      } else if (data.docType === "logistics") {
        await supabase
          .from("logistics_plans")
          .update({ extraction_status: "failed", extraction_error: extractionError })
          .eq("site_document_id", sd.id);
      }
    }

    return {
      siteDocumentId: sd.id,
      extractionStatus,
      extractionError,
    };
  });

export const listProjectDrawings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_drawings")
      .select(
        "id,drawing_no,revision,title,scale,level,zone,is_active,in_dabs,extraction_status,extraction_error,page_number,pack_id,pack_name,created_at,site_documents(file_name,mime_type)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .order("page_number", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDabsDrawings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_drawings")
      .select(
        "id,drawing_no,revision,title,scale,level,zone,is_active,in_dabs,extraction_status,extraction_error,page_number,pack_id,pack_name,created_at,site_documents(file_name,mime_type)",
      )
      .eq("project_id", data.projectId)
      .eq("in_dabs", true)
      .order("created_at", { ascending: false })
      .order("page_number", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setDrawingInDabs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ drawingId: z.string().uuid(), inDabs: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dwg, error: dErr } = await supabase
      .from("project_drawings")
      .select("id,project_id")
      .eq("id", data.drawingId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!dwg) throw new Error("Drawing not found");

    const { data: isAdmin, error: rErr } = await supabase.rpc("is_project_admin", {
      _project_id: dwg.project_id,
      _user_id: userId,
    });
    if (rErr) throw new Error(rErr.message);
    if (!isAdmin) throw new Error("Only project admins can change DABS availability.");

    const { error: uErr } = await supabase
      .from("project_drawings")
      .update({ in_dabs: data.inDabs })
      .eq("id", data.drawingId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, inDabs: data.inDabs };
  });

export const allocateZonesForDabsDrawing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ drawingId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dwg, error: dErr } = await supabase
      .from("project_drawings")
      .select("id,project_id,site_document_id,drawing_no,title,level")
      .eq("id", data.drawingId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!dwg) throw new Error("Drawing not found");

    const { data: isAdmin, error: rErr } = await supabase.rpc("is_project_admin", {
      _project_id: dwg.project_id,
      _user_id: userId,
    });
    if (rErr) throw new Error(rErr.message);
    if (!isAdmin) throw new Error("Only project admins can allocate DABS zones.");

    // Pull drawing text + any logistics zones as extra context.
    let drawingText = "";
    try {
      if (dwg.site_document_id) {
        drawingText = await downloadDocText(supabase, dwg.site_document_id);
      }
    } catch {
      drawingText = "";
    }

    const { data: logistics } = await supabase
      .from("logistics_plans")
      .select("extracted_zones")
      .eq("project_id", dwg.project_id);
    const logisticsZones = (logistics ?? [])
      .flatMap((l: any) => (Array.isArray(l.extracted_zones) ? l.extracted_zones : []))
      .filter((z: any) => z?.name);

    let zones: { name: string; level?: string | null }[] = [];
    try {
      const meta = await aiJson<{ zones?: { name: string; level?: string | null }[] }>(
        `This drawing "${dwg.drawing_no ?? ""} ${dwg.title ?? ""}" is now a live DABS work sheet. Identify the work zones / grid areas / levels a site manager would pin activities to. Return {"zones":[{"name":string,"level":string|null}]}. Do NOT invent zones — only what's shown on the sheet or corroborated by the logistics plan. Logistics-plan zones for cross-reference: ${JSON.stringify(logisticsZones).slice(0, 2000)}`,
        drawingText || `Drawing ${dwg.drawing_no ?? ""} — ${dwg.title ?? ""} (level ${dwg.level ?? "?"})`,
      );
      zones = (meta.zones ?? []).filter((z) => z?.name);
    } catch {
      zones = [];
    }

    let inserted = 0;
    for (const z of zones) {
      const { error: upErr } = await supabase.from("work_zones").upsert(
        {
          project_id: dwg.project_id,
          drawing_id: dwg.id,
          name: z.name,
          level: z.level ?? dwg.level ?? null,
          source: "oracle",
        },
        { onConflict: "project_id,name,level", ignoreDuplicates: true },
      );
      if (!upErr) inserted += 1;
    }
    return { zones, allocated: inserted };
  });




/** Plans stuck in "processing" longer than this are flipped to failed. */
const LOGISTICS_TIMEOUT_MS = 5 * 60 * 1000;

export const listProjectLogistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("logistics_plans")
      .select(
        "id,site_document_id,extracted_zones,extraction_status,extraction_error,extraction_started_at,created_at,updated_at,site_documents(file_name,mime_type)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Time-out sweep: anything left "processing" past the deadline is dead —
    // flag it honestly so the RETRY EXTRACTION button becomes actionable.
    const now = Date.now();
    const stale = (rows ?? []).filter((r: any) => {
      if (r.extraction_status !== "processing") return false;
      const started = new Date(r.extraction_started_at ?? r.updated_at ?? r.created_at).getTime();
      return Number.isFinite(started) && now - started > LOGISTICS_TIMEOUT_MS;
    });
    if (stale.length > 0) {
      const reason = "Extraction timed out — press RETRY EXTRACTION to re-run it.";
      await context.supabase
        .from("logistics_plans")
        .update({ extraction_status: "failed", extraction_error: reason })
        .in(
          "id",
          stale.map((r: any) => r.id),
        );
      for (const r of stale as any[]) {
        r.extraction_status = "failed";
        r.extraction_error = reason;
      }
    }
    return (rows ?? []) as any[];
  });

/**
 * Re-runs zone extraction on an existing logistics plan (image or PDF) and
 * links the resulting work zones back to the plan so provenance is honest.
 */
export const retryLogisticsExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ logisticsPlanId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan, error } = await supabase
      .from("logistics_plans")
      .select("id,project_id,site_document_id")
      .eq("id", data.logisticsPlanId)
      .maybeSingle();
    if (error || !plan) throw new Error("Logistics plan not found.");
    await ensureProjectAccess(supabase, userId, plan.project_id);

    await supabase
      .from("logistics_plans")
      .update({
        extraction_status: "processing",
        extraction_error: null,
        extraction_started_at: new Date().toISOString(),
      } as any)
      .eq("id", plan.id);

    try {
      const { extractLogisticsZones } = await import("./logistics-extract.server");
      const zones = await extractLogisticsZones(supabase, plan.site_document_id);

      if (zones.length === 0) {
        await supabase
          .from("logistics_plans")
          .update({
            extracted_zones: [],
            extraction_status: "empty",
            extraction_error:
              "No labelled work zones could be read from this plan. Add zones manually if needed.",
          })
          .eq("id", plan.id);
        return { status: "empty" as const, zonesExtracted: 0, zonesLinked: 0 };
      }

      await supabase
        .from("logistics_plans")
        .update({
          extracted_zones: zones as any,
          extraction_status: "complete",
          extraction_error: null,
        })
        .eq("id", plan.id);

      // Upsert work zones and stamp their source plan.
      const seen = new Set<string>();
      const rows = zones
        .map((z) => ({
          project_id: plan.project_id,
          name: z.name.trim(),
          level: z.level?.trim() || null,
          source: "logistics" as const,
          status: "active" as const,
          logistics_plan_id: plan.id,
        }))
        .filter((r) => {
          const k = `${r.name.toLowerCase()}|${(r.level ?? "").toLowerCase()}`;
          if (!r.name || seen.has(k)) return false;
          seen.add(k);
          return true;
        });

      let linked = 0;
      for (const row of rows) {
        const { error: upErr } = await (supabase as any)
          .from("work_zones")
          .upsert(row, { onConflict: "project_id,name,level,source" });
        if (!upErr) linked += 1;
      }
      return { status: "complete" as const, zonesExtracted: zones.length, zonesLinked: linked };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      await supabase
        .from("logistics_plans")
        .update({ extraction_status: "failed", extraction_error: msg })
        .eq("id", plan.id);
      throw new Error(msg);
    }
  });

/**
 * Groups the project's drawings by (drawing number + revision + sheet index),
 * falling back to file name when no metadata was parsed, and returns any group
 * with more than one row so the user can merge / delete the extras.
 */
export const listDuplicateDrawings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_drawings")
      .select(
        "id,drawing_no,revision,title,page_number,pack_name,in_dabs,created_at,site_documents(file_name)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const groups = new Map<string, any[]>();
    for (const r of (rows ?? []) as any[]) {
      const fileName = (Array.isArray(r.site_documents) ? r.site_documents[0] : r.site_documents)
        ?.file_name;
      const key = r.drawing_no
        ? `dwg:${String(r.drawing_no).toLowerCase()}|${String(r.revision ?? "").toLowerCase()}|${r.page_number ?? ""}`
        : `file:${String(fileName ?? r.id).toLowerCase()}`;
      const list = groups.get(key) ?? [];
      list.push({ ...r, file_name: fileName ?? null });
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({
        key,
        label:
          list[0].drawing_no
            ? `${list[0].drawing_no}${list[0].revision ? ` Rev ${list[0].revision}` : ""}${list[0].page_number ? ` · Sheet ${list[0].page_number}` : ""}`
            : (list[0].file_name ?? "Unnamed sheet"),
        rows: list,
      }));
  });

/** Deletes the given drawing rows (project admins and above). */
export const deleteDrawingsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), drawingIds: z.array(z.string().uuid()).min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("is_project_admin", {
      _project_id: data.projectId,
      _user_id: userId,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Project admin role required to remove drawings.");

    const { data: rows, error } = await supabase
      .from("project_drawings")
      .select("id,site_document_id")
      .eq("project_id", data.projectId)
      .in("id", data.drawingIds);
    if (error) throw new Error(error.message);

    const docIds = (rows ?? []).map((r: any) => r.site_document_id).filter(Boolean);
    if (docIds.length > 0) {
      const { error: delErr } = await supabase.from("site_documents").delete().in("id", docIds);
      if (delErr) throw new Error(delErr.message);
    }
    const { error: pdErr } = await supabase
      .from("project_drawings")
      .delete()
      .in("id", data.drawingIds);
    if (pdErr) throw new Error(pdErr.message);
    return { deleted: data.drawingIds.length };
  });

/**
 * Pre-flight duplicate check for a drawing pack upload, keyed on project +
 * pack/file name. Returns the sheets already registered under that name.
 */
export const checkDrawingPackDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), packName: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_drawings")
      .select("id,drawing_no,revision,page_number,created_at")
      .eq("project_id", data.projectId)
      .eq("pack_name", data.packName)
      .order("page_number", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      matches: (rows ?? []).map((r: any) => ({
        id: r.id,
        drawingNo: r.drawing_no,
        revision: r.revision,
        pageNumber: r.page_number,
        createdAt: r.created_at,
      })),
    };
  });


export const listProjectRams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rams_documents")
      .select(
        "id,trade_package,high_risk_flags,permit_required,created_at,site_documents(file_name)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listProjectZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("work_zones")
      .select("id,name,level,source,status,drawing_id,logistics_plan_id")
      .eq("project_id", data.projectId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getDrawingPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ drawingId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drawing, error } = await supabaseAdmin
      .from("project_drawings")
      .select("project_id,site_documents(file_path,bucket,mime_type,file_name)")
      .eq("id", data.drawingId)
      .maybeSingle();
    if (error || !drawing) throw new Error("Drawing not found");
    await ensureProjectAccess(supabase, userId, drawing.project_id);
    const sd = Array.isArray(drawing.site_documents)
      ? drawing.site_documents[0]
      : drawing.site_documents;
    if (!sd?.file_path) throw new Error("Source file missing");
    const bucket = sd.bucket ?? "project-bible";
    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(sd.file_path, 60 * 60);
    return {
      bucket,
      path: sd.file_path,
      mimeType: sd.mime_type ?? "application/octet-stream",
      fileName: sd.file_name ?? "drawing",
      signedUrl: signed?.signedUrl ?? null,
    };
  });



export const createDrawingDirectLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ drawingId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drawing, error } = await supabaseAdmin
      .from("project_drawings")
      .select("project_id")
      .eq("id", data.drawingId)
      .maybeSingle();
    if (error || !drawing) throw new Error("Drawing not found");
    await ensureProjectAccess(supabase, userId, drawing.project_id);


    const { createDrawingAccessToken, getDrawingAccessSecret } = await import(
      "./drawing-token.server"
    );
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const token = createDrawingAccessToken(
      {
        drawingId: data.drawingId,
        userId,
        exp: expiresAt,
        nonce: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      },
      getDrawingAccessSecret(),
    );
    const openPath = `/api/drawing/${data.drawingId}?access=${encodeURIComponent(token)}`;
    return {
      openPath,
      downloadPath: `${openPath}&download=1`,
      expiresAt,
    };
  });

const PageMeta = z.object({
  drawing_no: z.string(),
  revision: z.string(),
  title: z.string(),
  level: z.string(),
  zone: z.string(),
  zones: z
    .array(z.object({ name: z.string(), level: z.string() }))
    .default([]),
});


export const registerDrawingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        packId: z.string().uuid(),
        packName: z.string().min(1),
        pageNumber: z.number().int().positive(),
        fileName: z.string().min(1),
        filePath: z.string().min(1),
        fileSize: z.number().nonnegative(),
        mimeType: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectAccess(supabase, userId, data.projectId);
    if (!data.filePath.startsWith(`${userId}/`)) {
      throw new Error("Upload path must be under the signed-in user's folder.");
    }

    // 1) site_documents row for the page image
    const { data: sd, error: sdErr } = await supabase
      .from("site_documents")
      .insert({
        file_name: data.fileName,
        file_path: data.filePath,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        bucket: "project-bible",
        uploaded_by: userId,
        extraction_status: "processing",
      })
      .select("id")
      .single();
    if (sdErr) throw new Error(sdErr.message);

    // 2) project_drawings row for this sheet
    const { data: pd, error: pdErr } = await supabase
      .from("project_drawings")
      .insert({
        project_id: data.projectId,
        site_document_id: sd.id,
        page_number: data.pageNumber,
        pack_id: data.packId,
        pack_name: data.packName,
        extraction_status: "processing",
      })
      .select("id")
      .single();
    if (pdErr) throw new Error(pdErr.message);

    // 3) multimodal extraction on the page image
    let status: "complete" | "failed" = "complete";
    let errMsg: string | null = null;
    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

      const { data: blob, error: dlErr } = await supabase.storage
        .from("project-bible")
        .download(data.filePath);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "Page download failed");
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const base64 = btoa(bin);
      const dataUrl = `data:${data.mimeType};base64,${base64}`;

      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const { generateText, Output, NoObjectGeneratedError } = await import("ai");
      const gateway = createLovableAiGatewayProvider(apiKey);

      const prompt =
        `You are the InstructBrain Oracle inspecting ONE isolated construction drawing sheet (page ${data.pageNumber} of pack "${data.packName}"). ` +
        "Read the title block and any revision block. Return these fields as strings — use an empty string when a value is not visible. Never invent. " +
        "drawing_no (e.g. MCL-MFE-ZZ-XX-DR-A-0100), revision (e.g. P1), title (e.g. Level 01 General Arrangement Plan), level (e.g. Level 1), zone (e.g. West Wing).";

      let meta: z.infer<typeof PageMeta> | null = null;
      try {
        const { output } = await generateText({
          model: gateway("google/gemini-2.5-pro"),
          output: Output.object({ schema: PageMeta }),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image", image: dataUrl },
              ],
            },
          ],
        });
        meta = output;
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) {
          try {
            meta = PageMeta.parse(JSON.parse(err.text ?? "{}"));
          } catch {
            throw err;
          }
        } else {
          throw err;
        }
      }

      await supabase
        .from("project_drawings")
        .update({
          drawing_no: meta?.drawing_no || null,
          revision: meta?.revision || null,
          title: meta?.title || null,
          level: meta?.level || null,
          zone: meta?.zone || null,
          extraction_status: "complete",
        })
        .eq("id", pd.id);
      await supabase
        .from("site_documents")
        .update({ extraction_status: "complete" })
        .eq("id", sd.id);
    } catch (err) {
      status = "failed";
      errMsg = err instanceof Error ? err.message : "Extraction failed";
      await supabase
        .from("project_drawings")
        .update({ extraction_status: "failed", extraction_error: errMsg })
        .eq("id", pd.id);
      await supabase
        .from("site_documents")
        .update({ extraction_status: "failed", extraction_error: errMsg })
        .eq("id", sd.id);
    }

    return { drawingId: pd.id, siteDocumentId: sd.id, extractionStatus: status, extractionError: errMsg };
  });

/**
 * Extract sheet metadata from a single-page PDF (or image) using Gemini 2.5 Pro.
 */
async function extractSheetMeta(
  bytes: Uint8Array,
  mime: string,
  fileName: string,
  pageNumber: number,
  packName: string,
): Promise<z.infer<typeof PageMeta>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const { generateText, Output, NoObjectGeneratedError } = await import("ai");
  const gateway = createLovableAiGatewayProvider(apiKey);

  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const base64 = btoa(bin);
  const dataUrl = `data:${mime};base64,${base64}`;

  const prompt =
    `You are the InstructBrain Oracle inspecting ONE isolated construction drawing sheet (page ${pageNumber} of pack "${packName}"). ` +
    "Read the title block, revision block AND the drawing content itself. Return these fields — use an empty string / empty array when a value is not visible. Never invent. " +
    "drawing_no (e.g. MCL-MFE-ZZ-XX-DR-A-0100), revision (e.g. P1), title (e.g. Level 01 General Arrangement Plan), level (e.g. Level 1 / Ground Floor / Roof), zone (primary work zone shown, e.g. West Wing / Zone A), " +
    "zones = array of every distinct work zone / grid area / room block / underpinning sequence labelled ON the drawing itself (objects with 'name' and optional 'level'). If the sheet shows an underpinning or work sequence with numbered stages (A, B, C or 1, 2, 3), include each stage as a zone.";


  const isPdf = /pdf/i.test(mime);
  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: string; filename?: string }
    | { type: "image"; image: string }
  > = [
    { type: "text", text: prompt },
    isPdf
      ? { type: "file", data: dataUrl, mediaType: mime, filename: fileName }
      : { type: "image", image: dataUrl },
  ];

  try {
    const { output } = await generateText({
      model: gateway("google/gemini-2.5-pro"),
      output: Output.object({ schema: PageMeta }),
      messages: [{ role: "user", content }],
    });
    return output;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      try {
        return PageMeta.parse(JSON.parse(err.text ?? "{}"));
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Server-side splitter: takes a multi-page PDF that has been uploaded to the
 * `project-bible` bucket, splits it into single-page PDFs with pdf-lib,
 * uploads each page back to storage, creates a project_drawings row per page,
 * and runs Gemini 2.5 Pro against each individual sheet.
 */
export const splitAndRegisterDrawingPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        packName: z.string().min(1),
        rawFilePath: z.string().min(1),
        /** "replace" purges any sheets already registered under this pack name. */
        duplicatePolicy: z.enum(["replace", "keep_both"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectAccess(supabase, userId, data.projectId);
    if (!data.rawFilePath.startsWith(`${userId}/`)) {
      throw new Error("Upload path must be under the signed-in user's folder.");
    }

    // De-duplication: when the caller chose REPLACE, remove the existing sheets
    // registered under this pack name before re-registering them.
    if (data.duplicatePolicy === "replace") {
      const { data: existing } = await supabase
        .from("project_drawings")
        .select("id,site_document_id")
        .eq("project_id", data.projectId)
        .eq("pack_name", data.packName);
      const docIds = (existing ?? []).map((r: any) => r.site_document_id).filter(Boolean);
      if (docIds.length > 0) {
        await supabase.from("site_documents").delete().in("id", docIds);
      }
      const ids = (existing ?? []).map((r: any) => r.id);
      if (ids.length > 0) {
        await supabase.from("project_drawings").delete().in("id", ids);
      }
    }


    // 1) Download the raw pack.
    const { data: packBlob, error: dlErr } = await supabase.storage
      .from("project-bible")
      .download(data.rawFilePath);
    if (dlErr || !packBlob) throw new Error(dlErr?.message ?? "Pack download failed");
    const packBytes = new Uint8Array(await packBlob.arrayBuffer());

    // 2) Split with pdf-lib's bundled ESM build. Importing the package root can
    // resolve through its CJS/tslib helper path in SSR and crash with
    // "Cannot destructure property '__extends'..." before any PDF work starts.
    const { PDFDocument } = (await import("pdf-lib/dist/pdf-lib.esm.js")) as typeof import("pdf-lib");
    const src = await PDFDocument.load(packBytes, { ignoreEncryption: true });
    const pageCount = src.getPageCount();
    if (pageCount === 0) throw new Error("PDF contained no pages");

    const packId = crypto.randomUUID();
    const results: Array<{
      pageNumber: number;
      drawingId?: string;
      status: "complete" | "failed";
      error?: string | null;
    }> = [];

    for (let idx = 0; idx < pageCount; idx++) {
      const pageNumber = idx + 1;
      try {
        // Build a single-page PDF.
        const single = await PDFDocument.create();
        const [copied] = await single.copyPages(src, [idx]);
        single.addPage(copied);
        const singleBytes = await single.save();
        const pageFileName = `${data.packName.replace(/\.pdf$/i, "")}_p${pageNumber}.pdf`;
        const pagePath = `${userId}/${data.projectId}/drawing/pages/${packId}/page-${String(pageNumber).padStart(3, "0")}.pdf`;

        // Upload the single-page PDF (Uint8Array works with storage.upload).
        const { error: upErr } = await supabase.storage
          .from("project-bible")
          .upload(pagePath, singleBytes, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message);

        // site_documents + project_drawings rows.
        const { data: sd, error: sdErr } = await supabase
          .from("site_documents")
          .insert({
            file_name: pageFileName,
            file_path: pagePath,
            file_size: singleBytes.byteLength,
            mime_type: "application/pdf",
            bucket: "project-bible",
            uploaded_by: userId,
            extraction_status: "processing",
          })
          .select("id")
          .single();
        if (sdErr) throw new Error(sdErr.message);

        const { data: pd, error: pdErr } = await supabase
          .from("project_drawings")
          .insert({
            project_id: data.projectId,
            site_document_id: sd.id,
            page_number: pageNumber,
            pack_id: packId,
            pack_name: data.packName,
            extraction_status: "processing",
          })
          .select("id")
          .single();
        if (pdErr) throw new Error(pdErr.message);

        // AI extraction on this single-page PDF.
        try {
          const meta = await extractSheetMeta(
            singleBytes,
            "application/pdf",
            pageFileName,
            pageNumber,
            data.packName,
          );
          await supabase
            .from("project_drawings")
            .update({
              drawing_no: meta.drawing_no || null,
              revision: meta.revision || null,
              title: meta.title || null,
              level: meta.level || null,
              zone: meta.zone || null,
              extraction_status: "complete",
            })
            .eq("id", pd.id);
          await supabase
            .from("site_documents")
            .update({ extraction_status: "complete" })
            .eq("id", sd.id);

          // Zones are no longer auto-created from pack extraction. Oracle
          // allocates work zones only when a drawing is added to DABS.


          results.push({ pageNumber, drawingId: pd.id, status: "complete" });

        } catch (aiErr) {
          const msg = aiErr instanceof Error ? aiErr.message : "AI extraction failed";
          await supabase
            .from("project_drawings")
            .update({ extraction_status: "failed", extraction_error: msg })
            .eq("id", pd.id);
          await supabase
            .from("site_documents")
            .update({ extraction_status: "failed", extraction_error: msg })
            .eq("id", sd.id);
          results.push({ pageNumber, drawingId: pd.id, status: "failed", error: msg });
        }
      } catch (err) {
        results.push({
          pageNumber,
          status: "failed",
          error: err instanceof Error ? err.message : "Split failed",
        });
      }
    }

    // 3) Best-effort cleanup of the raw pack (we no longer need it).
    await supabase.storage.from("project-bible").remove([data.rawFilePath]);

    return {
      packId,
      packName: data.packName,
      totalPages: pageCount,
      completed: results.filter((r) => r.status === "complete").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  });


