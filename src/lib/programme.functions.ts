import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Server functions ----------------

/**
 * Compile a programme file inline (no external service).
 *
 * The client uploads the file to the `programme-uploads` bucket at
 * `<projectId>/<uuid>-<name>`. This handler downloads the object, runs the
 * internal TypeScript parser (`compileProgrammeFile`) — which handles PDF
 * (via unpdf), CSV, XML, XER and free text — writes
 * `programme_reference_tasks` + `daily_programme_playbooks` and marks the
 * job complete. The UI subscribes to `programme_jobs` via realtime and
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
        status: "parsing",
        progress: 5,
        stage: "downloading",
        created_by: userId,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message ?? "Job record failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildProgrammePlaybookRows, compileProgrammeFile } = await import(
      "@/lib/programme-compiler.server"
    );

    const fail = async (message: string) => {
      await supabaseAdmin
        .from("programme_jobs")
        .update({ status: "failed", error: message, progress: 100, stage: "failed" })
        .eq("id", job.id);
      await supabaseAdmin
        .from("programme_uploads")
        .update({ status: "failed" })
        .eq("id", up.id);
    };

    try {
      // 1. Download file
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from("programme-uploads")
        .download(data.storagePath);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "Download failed");

      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const dataBase64 = btoa(bin);

      // 2. Parse
      await supabaseAdmin
        .from("programme_jobs")
        .update({ status: "parsing", stage: "parsing", progress: 25 })
        .eq("id", job.id);

      const result = await compileProgrammeFile({
        fileName: data.fileName,
        mimeType: data.mimeType,
        dataBase64,
      });

      if (result.tasks.length === 0) {
        await fail(
          "Randall could not find dated activities. Try a text-based PDF or an XER / XML / CSV export.",
        );
        return { ok: false as const, jobId: job.id, uploadId: up.id };
      }

      // 3. Write reference tasks
      await supabaseAdmin
        .from("programme_jobs")
        .update({ status: "writing", stage: "tasks", progress: 60, strategy: result.source })
        .eq("id", job.id);

      const taskRows = result.tasks.map((t) => ({
        programme_upload_id: up.id,
        project_id: data.projectId,
        task_name: t.taskName || "Untitled task",
        plain_english: t.taskName || "Task",
        start_date: t.startDate,
        end_date: t.endDate,
        location: t.location || null,
        trade: t.trade || null,
      }));

      await supabaseAdmin
        .from("programme_reference_tasks")
        .delete()
        .eq("programme_upload_id", up.id);

      const batch = 200;
      for (let i = 0; i < taskRows.length; i += batch) {
        const { error } = await supabaseAdmin
          .from("programme_reference_tasks")
          .insert(taskRows.slice(i, i + batch));
        if (error) throw new Error(`programme_reference_tasks insert failed: ${error.message}`);
      }

      // 4. Build + write playbooks
      await supabaseAdmin
        .from("programme_jobs")
        .update({ stage: "playbooks", progress: 80 })
        .eq("id", job.id);

      const playbookRows = buildProgrammePlaybookRows({
        projectId: data.projectId,
        uploadId: up.id,
        tasks: result.tasks,
      });

      await supabaseAdmin
        .from("daily_programme_playbooks")
        .delete()
        .eq("project_id", data.projectId);

      for (let i = 0; i < playbookRows.length; i += batch) {
        const { error } = await supabaseAdmin
          .from("daily_programme_playbooks")
          .insert(playbookRows.slice(i, i + batch));
        if (error) throw new Error(`daily_programme_playbooks insert failed: ${error.message}`);
      }

      await supabaseAdmin
        .from("programme_uploads")
        .update({ task_count: result.tasks.length, status: "ready" })
        .eq("id", up.id);

      await supabaseAdmin
        .from("programme_jobs")
        .update({
          status: "complete",
          stage: "done",
          progress: 100,
          strategy: result.source,
          stats: {
            task_count: result.tasks.length,
            day_count: playbookRows.length,
            first_date: playbookRows[0]?.playbook_date ?? null,
            last_date: playbookRows[playbookRows.length - 1]?.playbook_date ?? null,
          },
        })
        .eq("id", job.id);

      return { ok: true as const, jobId: job.id, uploadId: up.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Programme compile failed";
      await fail(message);
      return { ok: false as const, jobId: job.id, uploadId: up.id, error: message };
    }
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
