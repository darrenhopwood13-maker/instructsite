import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Server functions ----------------

export const compileProgrammePlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        dataBase64: z.string().min(1),
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

    let compiled;
    try {
      const { compileProgrammeFile } = await import("@/lib/programme-compiler.server");
      compiled = await compileProgrammeFile({
        fileName: data.fileName,
        mimeType: data.mimeType,
        dataBase64: data.dataBase64,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Randall could not compile this programme.";
      console.error("[Randall] compile failed", err);
      return { ok: false as const, error: message };
    }
    const tasks = compiled.tasks;

    // Insert upload row
    const { data: up, error: upErr } = await supabase
      .from("programme_uploads")
      .insert({
        project_id: data.projectId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        uploaded_by: userId,
        task_count: tasks.length,
      })
      .select("id")
      .single();
    if (upErr || !up) throw new Error(upErr?.message ?? "Upload record failed");

    // Insert tasks
    const taskRows = tasks.map((t) => ({
      programme_upload_id: up.id,
      project_id: data.projectId,
      task_name: t.taskName || "Untitled task",
      plain_english: t.taskName || "Task",
      start_date: t.startDate,
      end_date: t.endDate,
      location: t.location || null,
      trade: t.trade || null,
    }));
    const { error: tErr } = await supabase.from("programme_reference_tasks").insert(taskRows);
    if (tErr) throw new Error(tErr.message);

    // Build deterministic day-to-a-page playbook
    const { buildProgrammePlaybookRows } = await import("@/lib/programme-compiler.server");
    const playbookRows = buildProgrammePlaybookRows({
      projectId: data.projectId,
      uploadId: up.id,
      tasks,
    });

    // Replace playbooks for this project
    await supabase
      .from("daily_programme_playbooks")
      .delete()
      .eq("project_id", data.projectId);

    if (playbookRows.length) {
      // insert in batches to keep payloads sane
      const batchSize = 100;
      for (let i = 0; i < playbookRows.length; i += batchSize) {
        const batch = playbookRows.slice(i, i + batchSize);
        const { error: pbErr } = await supabase.from("daily_programme_playbooks").insert(batch);
        if (pbErr) throw new Error(pbErr.message);
      }
    }

    console.info("[Randall] compile done", {
      taskCount: tasks.length,
      dayCount: playbookRows.length,
      source: compiled.source,
    });

    return {
      ok: true as const,
      uploadId: up.id,
      taskCount: tasks.length,
      dayCount: playbookRows.length,
      firstDate: playbookRows[0]?.playbook_date ?? null,
      lastDate: playbookRows[playbookRows.length - 1]?.playbook_date ?? null,
      source: compiled.source,
    };
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
