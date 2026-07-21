import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SnagReport = z.object({
  defectTitle: z.string(),
  description: z.string(),
  cause: z.string(),
  rectificationOptionA: z.string(),
  rectificationOptionB: z.string(),
  tradesmanHack: z.string(),
  regulatoryCitations: z.array(z.string()),
  hsNotes: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  trade: z.string(),
});
export type SnagReportT = z.infer<typeof SnagReport>;

async function getMyOrgId(supabase: any, userId: string, claims?: any): Promise<string> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.org_id) return data.org_id as string;

  // Founder fallback: founder isn't required to be an org member.
  const { isOwnerFromClaims } = await import("@/lib/owner");
  if (isOwnerFromClaims(claims)) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: firstOrg } = await supabaseAdmin
      .from("orgs")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstOrg?.id) return firstOrg.id as string;
    throw new Error("No organisation exists yet. Create one first.");
  }

  throw new Error("You are not a member of an organisation.");
}

/** List snags for the caller's org, optionally filtered by status. */
export const listSnags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ status: z.string().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("snags")
      .select("id, defect_title, severity, status, trade, photo_path, created_at, created_by")
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Sign photo URLs (1h)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("snag-photos")
          .createSignedUrl(r.photo_path, 3600);
        return { ...r, photoUrl: signed?.signedUrl ?? null };
      }),
    );
    return items;
  });

export const getSnag = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ snagId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: snag, error } = await context.supabase
      .from("snags")
      .select("*")
      .eq("id", data.snagId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!snag) throw new Error("Snag not found.");

    const { data: comments } = await context.supabase
      .from("snag_comments")
      .select("id, user_id, body, created_at")
      .eq("snag_id", data.snagId)
      .order("created_at", { ascending: true });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("snag-photos")
      .createSignedUrl(snag.photo_path, 3600);

    return { snag, comments: comments ?? [], photoUrl: signed?.signedUrl ?? null };
  });

/** Upload photo → analyze with GPT-4o Vision via Lovable AI Gateway. Returns structured report + photoPath. */
export const analyzeSnag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        fileName: z.string(),
        mimeType: z.string(),
        dataBase64: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    if (!/^image\//i.test(data.mimeType)) {
      throw new Error("Please upload an image file.");
    }

    const orgId = await getMyOrgId(context.supabase, context.userId, context.claims);

    // Upload photo to snag-photos/{orgId}/{uuid}.ext via admin client (still stored under org folder for RLS)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const photoPath = `${orgId}/${crypto.randomUUID()}.${ext || "jpg"}`;
    const buf = Buffer.from(data.dataBase64, "base64");

    // Auto-create the snag-photos bucket if it doesn't exist (first-use setup)
    // This covers cases where the SQL migration hasn't been applied yet.
    const bucketName = "snag-photos";
    try {
      const { error: upErr } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(photoPath, buf, { contentType: data.mimeType, upsert: false });
      if (upErr) throw upErr;
    } catch (upErr: any) {
      // If the bucket doesn't exist, create it and retry once
      if (upErr?.message?.includes("bucket") || upErr?.message?.includes("not found") || upErr?.statusCode === 404) {
        console.warn(`[SnagAnalyze] Bucket "${bucketName}" not found — attempting to create it`);
        const { error: createErr } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 10485760, // 10 MB
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
        });
        if (createErr) {
          throw new Error(`Storage bucket "${bucketName}" not found and auto-creation failed: ${createErr.message}`);
        }

        // Retry the upload after creating the bucket
        const { error: retryErr } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(photoPath, buf, { contentType: data.mimeType, upsert: false });
        if (retryErr) throw new Error(`Photo upload failed: ${retryErr.message}`);
      } else {
        throw new Error(`Photo upload failed: ${upErr?.message || String(upErr)}`);
      }
    }

    const gateway = createLovableAiGatewayProvider(key);
    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;

    const systemPrompt = [
      "# IDENTITY — THE ORACLE (Defect Inspection Mode)",
      "You are The Oracle: the most qualified site manager, HSE director, design manager, architect, and engineer in the history of the construction industry — distilled into a single advisor.",
      "",
      "## Career (30 years, top-tier)",
      "- 30 years of top-tier construction experience across residential, commercial, civils, heritage, and high-risk projects.",
      "- 15 of those 30 years served specifically as a Senior Construction Health, Safety and Environment (HSE) Officer, personally responsible for RAMS, risk assessments, method statements, permits-to-work, and full statutory compliance (CDM 2015, HSG150, HSG151, HSG47, Work at Height Regs, LOLER, PUWER, COSHH).",
      "",
      "## Fellowships (decorated across all major UK governing bodies)",
      "You are a full Fellow of each of the following and speak with their authority:",
      "- FCIOB — Chartered Institute of Building",
      "- FRICS — Royal Institution of Chartered Surveyors",
      "- FICE — Institution of Civil Engineers",
      "- FRIBA — Royal Institute of British Architects",
      "- FIStructE — Institution of Structural Engineers",
      "- FBIID — British Institute of Interior Design",
      "- FENSA — Fenestration Self-Assessment Scheme (windows, doors, glazing — Building Regs Part L/F/Q compliance)",
      "- NICEIC — National Inspection Council for Electrical Installation Contracting (Part P, BS 7671)",
      "",
      "## Multi-Trade Expertise (hands-on, not just management)",
      "Deep, practical, tools-in-hand knowledge of: bricklaying and masonry, joinery and carpentry (1st/2nd fix), plumbing and drainage, electrical (with awareness of Part P and BS 7671), structural works (steel, concrete, timber frame), roofing, plastering, groundworks, and MEP coordination.",
      "",
      "## Operating Mode",
      "You are inspecting a photograph of a construction defect (a 'snag'). Produce a full site report drawing on your full design, architectural, structural, and regulatory expertise.",
      "- Be blunt, technical, and specific — as a senior site manager inspecting a trade's work.",
      "- Cite your relevant fellowship body inline when your assessment touches its remit (e.g. 'Per RICS guidance on measurement…', 'Per IStructE best practice on structural loading…', 'Per RIBA Plan of Work design stage…', 'Per HSE/CDM 2015 for safe access…', 'Per FENSA for glazing/fenestration compliance…', 'Per NICEIC / BS 7671 for electrical installation…').",
      "- Cite real UK regulations: Building Regs Part L/E/B/K, BS 8000, BS 5395, CDM 2015, HSE guidance, NHBC Standards.",
      "- The 'tradesman's hack' is a hard-won trade tip a senior foreman would tell a green apprentice — practical, cheap, effective.",
      "- The severity assessment must consider architectural impact, structural risk, and safety implications together.",
    ].join("\n");

    try {
      const { output } = await generateText({
        model: gateway("openai/gpt-4o"),
        system: systemPrompt,
        output: Output.object({ schema: SnagReport }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "As The Oracle, inspect this snag photo with your full 30 years of site, design, architectural, structural, and regulatory expertise. Draw on your fellowships — RICS for measurement/quality, ICE/IStructE for structural, RIBA for design intent, CIOB for trade quality, BIID for interior fit-out, HSE for safety. Return a JSON report with: defectTitle (5–8 words), description (2–4 sentences citing trade impact), cause (root cause), rectificationOptionA (proper by-the-book fix referencing relevant regulations), rectificationOptionB (fast/budget alternative), tradesmanHack (real trade tip), regulatoryCitations (array of relevant UK regs/standards and which fellowship body governs them), hsNotes (health & safety concerns with CDM 2015 relevance), severity (low/medium/high/critical — consider structural, architectural and safety risk together), trade (which trade owns this: bricklayer/carpenter/plumber/electrician/tiler/steelworker/roofer etc).",
              },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });
      return { report: output, photoPath };
    } catch (error) {
      // Clean up the orphan upload if AI failed
      await supabaseAdmin.storage.from("snag-photos").remove([photoPath]).catch(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (error as any)?.message || "AI analysis failed.";
      throw new Error(msg);
    }
  });

export const createSnag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        photoPath: z.string(),
        report: SnagReport,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const orgId = await getMyOrgId(context.supabase, context.userId, context.claims);
    const { data: row, error } = await context.supabase
      .from("snags")
      .insert({
        org_id: orgId,
        photo_path: data.photoPath,
        defect_title: data.report.defectTitle,
        description: data.report.description,
        cause: data.report.cause,
        rectification_option_a: data.report.rectificationOptionA,
        rectification_option_b: data.report.rectificationOptionB,
        tradesman_hack: data.report.tradesmanHack,
        regulatory_citations: data.report.regulatoryCitations,
        hs_notes: data.report.hsNotes,
        severity: data.report.severity,
        trade: data.report.trade,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateSnagStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        snagId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "closed", "disputed"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("snags")
      .update({ status: data.status })
      .eq("id", data.snagId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const postSnagComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        snagId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const orgId = await getMyOrgId(context.supabase, context.userId, context.claims);
    const { error } = await context.supabase.from("snag_comments").insert({
      snag_id: data.snagId,
      org_id: orgId,
      user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
