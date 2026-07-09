import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Server functions ----------------

/**
 * Enqueue an async Randall parsing job.
 *
 * Flow:
 *   1. The client has already uploaded the programme file to the
 *      `programme-uploads` Supabase Storage bucket at `<projectId>/<uuid>-<name>`.
 *   2. This server function creates a `programme_uploads` row and a
 *      `programme_jobs` row, signs the storage object for 1 hour, and
 *      POSTs `{ job_id, project_id, signed_url, file_name, mime_type,
 *      callback_url }` to the external Python parser.
 *   3. The parser processes in the background and calls back
 *      `/api/public/hooks/programme-ingest` with the parsed tasks.
 *
 * The UI subscribes to the `programme_jobs` row via Supabase realtime and
 * shows progress live.
 */
export const enqueueProgrammeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        storagePath: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_project_admin", {
      _project_id: data.projectId,
      _user_id: userId,
    });
    if (!isAdmin) throw new Error("Only project admins can compile programmes.");

    const parserUrl = process.env.PROGRAMME_PARSER_URL;
    const parserSecret = process.env.PROGRAMME_PARSER_SECRET;
    if (!parserUrl || !parserSecret) {
      throw new Error(
        "Randall parser is not configured yet. Add the PROGRAMME_PARSER_URL secret in Lovable Cloud once the Python service is deployed.",
      );
    }

    const { data: up, error: upErr } = await supabase
      .from("programme_uploads")
      .insert({
        project_id: data.projectId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        uploaded_by: userId,
        task_count: 0,
        storage_path: data.storagePath,
        status: "queued",
      })
      .select("id")
      .single();
    if (upErr || !up) throw new Error(upErr?.message ?? "Upload record failed");

    const { data: job, error: jobErr } = await supabase
      .from("programme_jobs")
      .insert({
        project_id: data.projectId,
        upload_id: up.id,
        status: "queued",
        progress: 0,
        stage: "queued",
        created_by: userId,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message ?? "Job record failed");

    const { data: signed, error: signErr } = await supabase.storage
      .from("programme-uploads")
      .createSignedUrl(data.storagePath, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message ?? "Could not sign programme file");
    }

    const appOrigin = process.env.APP_ORIGIN ?? "https://instructsite.lovable.app";
    const callbackUrl = `${appOrigin.replace(/\/$/, "")}/api/public/hooks/programme-ingest`;

    try {
      const res = await fetch(`${parserUrl.replace(/\/$/, "")}/parse`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${parserSecret}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          project_id: data.projectId,
          signed_url: signed.signedUrl,
          file_name: data.fileName,
          mime_type: data.mimeType,
          callback_url: callbackUrl,
        }),
      });
      if (!res.ok && res.status !== 202) {
        const body = await res.text().catch(() => "");
        throw new Error(`Parser rejected job (${res.status}): ${body.slice(0, 200)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach Randall parser";
      await supabase
        .from("programme_jobs")
        .update({ status: "failed", error: message, progress: 100 })
        .eq("id", job.id);
      throw new Error(message);
    }

    await supabase
      .from("programme_jobs")
      .update({ status: "parsing", stage: "dispatched", progress: 8 })
      .eq("id", job.id);

    return { ok: true as const, jobId: job.id, uploadId: up.id };
  });

export const getProgrammeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ jobId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("programme_jobs")
      .select("id, project_id, status, stage, strategy, progress, error, stats, created_at, updated_at")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getLatestProgrammeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("programme_jobs")
      .select("id, status, stage, strategy, progress, error, stats, updated_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row;
  });


export const getPlaybookForDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("daily_programme_playbooks")
      .select("playbook_date, ai_daily_summary")
      .eq("project_id", data.projectId)
      .eq("playbook_date", data.date)
      .maybeSingle();
    return row ?? null;
  });

export const getPlaybookRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("daily_programme_playbooks")
      .select("playbook_date")
      .eq("project_id", data.projectId)
      .order("playbook_date", { ascending: true });
    const dates = (rows ?? []).map((r) => r.playbook_date as string);
    return {
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      dates,
    };
  });

export const listManagerNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("programme_manager_notes")
      .select("id, body, author_id, author_name, created_at, updated_at")
      .eq("project_id", data.projectId)
      .eq("note_date", data.date)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addManagerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const authorName =
      (profile as { full_name?: string } | null)?.full_name ?? "Site Manager";

    const { data: row, error } = await context.supabase
      .from("programme_manager_notes")
      .insert({
        project_id: data.projectId,
        note_date: data.date,
        author_id: context.userId,
        author_name: authorName,
        body: data.body,
      })
      .select("id, body, author_id, author_name, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
