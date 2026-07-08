import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { compileProgrammeFile, type ProgrammeTask } from "@/lib/programme-compiler.server";

// ---------------- Schemas ----------------

type Task = ProgrammeTask;

// ---------------- Date helpers ----------------

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}
function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86_400_000);
}
function isIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ---------------- Deterministic playbook writer ----------------

function buildRichSummary(date: string, tasks: Task[]): string {
  const active = tasks.filter((t) => t.startDate <= date && date <= t.endDate);
  if (active.length === 0) return "";

  const starts = active.filter((t) => t.startDate === date);
  const ends = active.filter((t) => t.endDate === date);

  const byTrade = new Map<string, Task[]>();
  for (const t of active) {
    const key = t.trade?.trim() || "General";
    if (!byTrade.has(key)) byTrade.set(key, []);
    byTrade.get(key)!.push(t);
  }

  const headline =
    active.length >= 4
      ? `Heavy day — ${active.length} activities live across ${byTrade.size} trade${byTrade.size === 1 ? "" : "s"}.`
      : active.length === 1
        ? `Focused day — ${active[0].taskName} on site.`
        : `${active.length} activities live across ${byTrade.size} trade${byTrade.size === 1 ? "" : "s"}.`;

  const lines: string[] = [headline, ""];

  for (const [trade, list] of byTrade) {
    lines.push(`${trade.toUpperCase()}`);
    for (const t of list) {
      const total = Math.max(1, diffDays(t.startDate, t.endDate) + 1);
      const dayNo = Math.max(1, diffDays(t.startDate, date) + 1);
      const loc = t.location ? ` [${t.location}]` : "";
      const flag =
        t.startDate === date ? " · STARTS TODAY"
        : t.endDate === date ? " · ENDS TODAY"
        : "";
      lines.push(`• ${t.taskName}${loc} — Day ${dayNo} of ${total}${flag}`);
    }
    lines.push("");
  }

  if (starts.length + ends.length > 0) {
    const notes: string[] = [];
    if (starts.length) notes.push(`Kicking off: ${starts.map((s) => s.taskName).join(", ")}.`);
    if (ends.length) notes.push(`Wrapping up: ${ends.map((s) => s.taskName).join(", ")}.`);
    lines.push(notes.join(" "));
  }

  // Location clash
  const locGroups = new Map<string, Task[]>();
  for (const t of active) {
    const loc = t.location?.trim();
    if (!loc) continue;
    if (!locGroups.has(loc)) locGroups.set(loc, []);
    locGroups.get(loc)!.push(t);
  }
  for (const [loc, ts] of locGroups) {
    if (ts.length > 1) {
      lines.push(`Coordination flag — ${ts.length} trades sharing ${loc}: ${ts.map((t) => t.taskName).join(" · ")}.`);
    }
  }

  return lines.join("\n").trim();
}

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
    const starts = tasks.map((t) => t.startDate).sort();
    const ends = tasks.map((t) => t.endDate).sort();
    const first = starts[0];
    const last = ends[ends.length - 1];

    const playbookRows: {
      project_id: string;
      programme_upload_id: string;
      playbook_date: string;
      ai_daily_summary: string;
    }[] = [];

    if (first && last) {
      const maxDays = 400;
      const total = Math.min(maxDays, diffDays(first, last) + 1);
      for (let i = 0; i < total; i++) {
        const date = addDays(first, i);
        const summary = buildRichSummary(date, tasks);
        if (summary) {
          playbookRows.push({
            project_id: data.projectId,
            programme_upload_id: up.id,
            playbook_date: date,
            ai_daily_summary: summary,
          });
        }
      }
    }

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
