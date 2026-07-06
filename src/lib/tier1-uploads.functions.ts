import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      })
      .select("id")
      .single();
    if (sdErr) throw new Error(sdErr.message);

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
    try {
      const rawText = await downloadDocText(supabase, sd.id);
      if (!rawText || rawText.trim().length < 20) {
        extractionStatus = "empty";
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
        for (const z of meta.zones ?? []) {
          if (!z?.name) continue;
          await supabase
            .from("work_zones")
            .upsert(
              {
                project_id: data.projectId,
                name: z.name,
                level: z.level ?? meta.level ?? null,
                source: "drawing",
              },
              { onConflict: "project_id,name,level", ignoreDuplicates: true },
            );
        }
        extractionStatus = "complete";
      } else if (data.docType === "logistics") {
        const meta = await aiJson<{
          zones: { name: string; level?: string; description?: string }[];
        }>(
          'Extract the work zones / site areas / levels described in this Site Logistics Plan. Return JSON: { "zones": [{ "name": string, "level"?: string, "description"?: string }] }.',
          rawText,
        );
        await supabase
          .from("logistics_plans")
          .update({
            extracted_zones: meta.zones ?? [],
            extraction_status: "complete",
          })
          .eq("site_document_id", sd.id);
        for (const z of meta.zones ?? []) {
          if (!z?.name) continue;
          await supabase
            .from("work_zones")
            .upsert(
              {
                project_id: data.projectId,
                name: z.name,
                level: z.level ?? null,
                source: "logistics",
              },
              { onConflict: "project_id,name,level", ignoreDuplicates: true },
            );
        }
        extractionStatus = "complete";
      } else {
        extractionStatus = "complete";
      }
      await supabase
        .from("site_documents")
        .update({ extraction_status: extractionStatus, extraction_error: null })
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


export const listProjectLogistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("logistics_plans")
      .select(
        "id,extracted_zones,extraction_status,extraction_error,created_at,site_documents(file_name)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
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
      .select("id,name,level,source,status")
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
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectAccess(supabase, userId, data.projectId);
    if (!data.rawFilePath.startsWith(`${userId}/`)) {
      throw new Error("Upload path must be under the signed-in user's folder.");
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

          // Upsert every zone the Oracle spotted on this sheet.
          const zoneCandidates: { name: string; level: string | null }[] = [];
          if (meta.zone) zoneCandidates.push({ name: meta.zone, level: meta.level || null });
          for (const z of meta.zones ?? []) {
            if (z?.name) zoneCandidates.push({ name: z.name, level: z.level || meta.level || null });
          }
          for (const z of zoneCandidates) {
            await supabase.from("work_zones").upsert(
              {
                project_id: data.projectId,
                name: z.name,
                level: z.level,
                source: "drawing",
              },
              { onConflict: "project_id,name,level", ignoreDuplicates: true },
            );
          }

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


