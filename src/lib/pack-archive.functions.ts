import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PACK_BUCKET = "subcontractor-packs";

const countsSchema = z.object({
  labour: z.number().int().min(0),
  registers: z.number().int().min(0),
  talks: z.number().int().min(0),
  lookAhead: z.number().int().min(0),
});

async function ensureProjectMember(supabase: any, userId: string, projectId: string) {
  const { data, error } = await supabase.rpc("is_project_member", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You don't have access to this project.");
}

/**
 * Reserve an archive slot for a pack about to be generated.
 * Returns the versioned storage path the client should upload the PDF to.
 * Re-issuing the same range creates a NEW version — nothing is overwritten.
 */
export const createPackIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        subcontractorId: z.string().uuid(),
        rangeStart: z.string().trim().min(1).nullable().optional(),
        rangeEnd: z.string().trim().min(1).nullable().optional(),
        filename: z.string().trim().min(1).max(200),
        counts: countsSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectMember(supabase, userId, data.projectId);

    const { data: project } = await supabase
      .from("projects")
      .select("org_id")
      .eq("id", data.projectId)
      .maybeSingle();

    const rangeStart = data.rangeStart || null;
    const rangeEnd = data.rangeEnd || null;

    let q = supabase
      .from("subcontractor_pack_issues")
      .select("version")
      .eq("project_id", data.projectId)
      .eq("subcontractor_id", data.subcontractorId)
      .order("version", { ascending: false })
      .limit(1);
    q = rangeStart ? q.eq("range_start", rangeStart) : q.is("range_start", null);
    q = rangeEnd ? q.eq("range_end", rangeEnd) : q.is("range_end", null);
    const { data: prior } = await q;
    const version = ((prior?.[0]?.version as number | undefined) ?? 0) + 1;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `${data.projectId}/${data.subcontractorId}/${rangeStart ?? "start"}_${rangeEnd ?? "today"}_v${version}_${stamp}.pdf`;

    const { data: row, error } = await supabase
      .from("subcontractor_pack_issues")
      .insert({
        project_id: data.projectId,
        subcontractor_id: data.subcontractorId,
        org_id: (project?.org_id as string | null) ?? null,
        range_start: rangeStart,
        range_end: rangeEnd,
        version,
        generated_by: userId,
        filename: data.filename,
        storage_path: storagePath,
        counts: data.counts,
      })
      .select("id, version, storage_path")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id as string, version: row.version as number, storagePath: row.storage_path as string };
  });

/** Record the uploaded byte size once the PDF has landed in storage. */
export const finalizePackIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ issueId: z.string().uuid(), byteSize: z.number().int().min(0) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("subcontractor_pack_issues")
      .update({ byte_size: data.byteSize })
      .eq("id", data.issueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PackIssue = {
  id: string;
  version: number;
  filename: string;
  storagePath: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  generatedAt: string;
  generatedBy: string;
  generatedByName: string | null;
  byteSize: number | null;
  counts: { labour?: number; registers?: number; talks?: number; lookAhead?: number };
};

export const listPackIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        subcontractorId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<PackIssue[]> => {
    const { supabase, userId } = context;
    await ensureProjectMember(supabase, userId, data.projectId);

    let q = supabase
      .from("subcontractor_pack_issues")
      .select("id,version,filename,storage_path,range_start,range_end,generated_at,generated_by,byte_size,counts")
      .eq("project_id", data.projectId)
      .order("generated_at", { ascending: false })
      .limit(200);
    if (data.subcontractorId) q = q.eq("subcontractor_id", data.subcontractorId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.generated_by).filter(Boolean)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      for (const p of (profs ?? []) as any[]) {
        const n = (p.full_name ?? "").trim();
        if (n) names.set(p.user_id, n);
      }
      // Fall back to the auth account (email local-part) for users without a
      // profile row or a blank name. Only truly deleted accounts stay unknown.
      const missing = ids.filter((id) => !names.get(id));
      if (missing.length) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await Promise.all(
          missing.map(async (id) => {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(id as string);
            const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
            const metaName =
              typeof meta.full_name === "string"
                ? meta.full_name.trim()
                : typeof meta.name === "string"
                  ? meta.name.trim()
                  : "";
            const email = u?.user?.email ?? "";
            const resolved = metaName || (email ? email.split("@")[0] : "");
            if (resolved) names.set(id as string, resolved);
          }),
        );
      }
    }

    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      version: r.version,
      filename: r.filename,
      storagePath: r.storage_path,
      rangeStart: r.range_start,
      rangeEnd: r.range_end,
      generatedAt: r.generated_at,
      generatedBy: r.generated_by,
      generatedByName: names.get(r.generated_by) || null,
      byteSize: r.byte_size,
      counts: (r.counts ?? {}) as PackIssue["counts"],
    }));
  });

/** Signed URL for a previously issued pack — fetches the stored file, never regenerates. */
export const getPackIssueSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ issueId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("subcontractor_pack_issues")
      .select("project_id, storage_path, filename")
      .eq("id", data.issueId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Pack not found.");
    await ensureProjectMember(supabase, userId, row.project_id as string);

    const { data: signed, error: sErr } = await supabase.storage
      .from(PACK_BUCKET)
      .createSignedUrl(row.storage_path as string, 60 * 10, { download: row.filename as string });
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null, filename: row.filename as string };
  });
