import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORACLE_PERSONA } from "@/lib/oracle-persona";


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
  const { resolveActingOrgId } = await import("@/lib/org-membership.server");
  return resolveActingOrgId(supabase, userId, claims);
}


/** List snags for the caller's org, optionally filtered by status. */
export const listSnags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.string().optional(),
        projectId: z.string().uuid().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("snags")
      .select(
        "id, defect_title, severity, status, trade, photo_path, created_at, created_by, project_id, projects:project_id(id,name)",
      )
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Sign photo URLs (1h)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("snag-photos")
          .createSignedUrl(r.photo_path, 3600);
        return {
          ...r,
          projectName: (r as any).projects?.name ?? null,
          photoUrl: signed?.signedUrl ?? null,
        };
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
      .select("*, projects:project_id(id,name)")
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

    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;

    const systemPrompt = [
      ORACLE_PERSONA,
      "",
      "## Mode: Defect Inspection (Snag Master)",
      "You're inspecting a photograph of a construction defect ('snag'). Produce a full site report drawing on your full site-management, design, structural and regulatory experience.",
      "- Be blunt, technical and specific — the way a senior site manager talks to a trade about their work. A touch of dry London wit is fine; safety calls stay straight.",
      "- Cite the relevant body inline when it touches its remit (CIOB, RICS, IStructE, RIBA, HSE / CDM 2015, FENSA for glazing, NICEIC / BS 7671 for electrical).",
      "- Cite real UK regs where applicable: Building Regs Part L/E/B/K, BS 8000, BS 5395, CDM 2015, HSE guidance, NHBC Standards.",
      "- The 'tradesman's hack' is a hard-won trade tip a senior foreman would tell a green apprentice — practical, cheap, effective.",
      "- The severity assessment must weigh architectural impact, structural risk and safety together.",
      "",
      "OUTPUT: Reply with ONLY a single JSON object matching this exact shape. No markdown fences, no prose before or after.",
      `{"defectTitle": string, "description": string, "cause": string, "rectificationOptionA": string, "rectificationOptionB": string, "tradesmanHack": string, "regulatoryCitations": string[], "hsNotes": string, "severity": "low"|"medium"|"high"|"critical", "trade": string}`,
    ].join("\n");

    const userText =
      "As The Oracle, inspect this snag photo with your full 30 years of site, design, architectural, structural, and regulatory expertise. Return the JSON report described in the system prompt.";

    let raw: string;
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        await supabaseAdmin.storage.from("snag-photos").remove([photoPath]).catch(() => {});
        if (resp.status === 429) throw new Error("Rate limit hit — hold on and try again in a moment.");
        if (resp.status === 402) throw new Error("Out of AI credits — top up the workspace to keep the Oracle online.");
        throw new Error(`AI gateway ${resp.status}: ${body.slice(0, 400) || "no body"}`);
      }

      const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      raw = json.choices?.[0]?.message?.content ?? "";
      if (!raw.trim()) throw new Error("The Oracle returned an empty report — try a clearer photo.");
    } catch (error) {
      await supabaseAdmin.storage.from("snag-photos").remove([photoPath]).catch(() => {});
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(msg);
    }

    let parsed: unknown;
    try {
      // Strip accidental ```json fences just in case.
      const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      await supabaseAdmin.storage.from("snag-photos").remove([photoPath]).catch(() => {});
      throw new Error("The Oracle's reply was not valid JSON — try again.");
    }

    const validated = SnagReport.safeParse(parsed);
    if (!validated.success) {
      await supabaseAdmin.storage.from("snag-photos").remove([photoPath]).catch(() => {});
      throw new Error("The Oracle's report was missing required fields — try again.");
    }
    return { report: validated.data, photoPath };
  });

export const createSnag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        photoPath: z.string(),
        projectId: z.string().uuid(),
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
        project_id: data.projectId,
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

/** Open snag count for a project (org-scoped by RLS). */
export const countOpenSnagsForProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("snags")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId)
      .in("status", ["open", "in_progress", "disputed"]);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });
