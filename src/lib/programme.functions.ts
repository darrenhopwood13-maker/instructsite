import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const TaskSchema = z.object({
  taskName: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),
  trade: z.string().default(""),
  location: z.string().default(""),
  plainEnglish: z.string().default(""),
});

const CompileSchema = z.object({
  projectStart: z.string().default(""),
  projectEnd: z.string().default(""),
  tasks: z.array(TaskSchema).default([]),
  dailySummaries: z
    .array(z.object({ date: z.string(), summary: z.string() }))
    .default([]),
});

type Task = z.infer<typeof TaskSchema>;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86_400_000);
}

function buildDeterministicSummary(date: string, tasks: Task[]): string {
  const active = tasks.filter((t) => t.startDate <= date && date <= t.endDate);
  if (active.length === 0) return "No scheduled activity on site for this date.";
  const lines = active.map((t) => {
    const total = Math.max(1, diffDays(t.startDate, t.endDate) + 1);
    const dayNo = Math.max(1, diffDays(t.startDate, date) + 1);
    const label = t.taskName || t.trade || "Task";
    const loc = t.location ? ` (${t.location})` : "";
    return `• ${label}${loc} — Day ${dayNo} of ${total}.`;
  });
  const overlap =
    active.length > 1
      ? `\nOverlapping today: ${active.map((t) => t.taskName).join(" · ")}.`
      : "";
  return lines.join("\n") + overlap;
}

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

    // Auth gate: only project admins can compile
    const { data: isAdmin } = await supabase.rpc("is_project_admin", {
      _project_id: data.projectId,
      _user_id: userId,
    });
    if (!isAdmin) throw new Error("Only project admins can compile programmes.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const isPdf = /pdf/i.test(data.mimeType);
    const isCsv = /csv|excel|sheet|text/i.test(data.mimeType) || /\.csv$/i.test(data.fileName);

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: string; mediaType: string; filename?: string }
    > = [
      {
        type: "text",
        text:
          "You are Randall, the InstructSite programme compiler. Read this construction programme (Gantt / task list). Identify every task with its start date, end date, trade, and location. Then produce a plain-English daily summary for EVERY active date from project start to project end. Each daily summary must explicitly name every task active on that date, state 'Day X of Y' for each, and call out overlapping tasks. Dates must be ISO YYYY-MM-DD. Return strictly the JSON schema. If a date has no tasks, omit it.",
      },
    ];
    if (isPdf || isCsv) {
      userContent.push({
        type: "file",
        data: `data:${data.mimeType};base64,${data.dataBase64}`,
        mediaType: data.mimeType,
        filename: data.fileName,
      });
    } else {
      throw new Error("Upload a PDF or CSV programme.");
    }

    let parsed: z.infer<typeof CompileSchema>;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-pro"),
        output: Output.object({ schema: CompileSchema }),
        messages: [{ role: "user", content: userContent }],
      });
      parsed = output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const raw = err.text ?? "";
        const cleaned = raw
          .replace(/```json\s*/gi, "")
          .replace(/```\s*/g, "")
          .trim();
        const s = cleaned.search(/[{[]/);
        const e = cleaned.lastIndexOf("}");
        if (s >= 0 && e > s) {
          try {
            parsed = CompileSchema.parse(JSON.parse(cleaned.slice(s, e + 1)));
          } catch {
            parsed = CompileSchema.parse({});
          }
        } else {
          parsed = CompileSchema.parse({});
        }
      } else {
        throw err;
      }
    }

    if (parsed.tasks.length === 0) {
      throw new Error("Randall could not identify any tasks in this programme.");
    }

    // Insert programme_uploads row
    const { data: up, error: upErr } = await supabase
      .from("programme_uploads")
      .insert({
        project_id: data.projectId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        uploaded_by: userId,
        task_count: parsed.tasks.length,
      })
      .select("id")
      .single();
    if (upErr || !up) throw new Error(upErr?.message ?? "Upload record failed");

    // Insert tasks
    const validTasks = parsed.tasks.filter(
      (t) => /^\d{4}-\d{2}-\d{2}$/.test(t.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(t.endDate),
    );
    if (validTasks.length) {
      const rows = validTasks.map((t) => ({
        programme_upload_id: up.id,
        project_id: data.projectId,
        task_name: t.taskName || "Untitled task",
        plain_english: t.plainEnglish || t.taskName || "Task",
        start_date: t.startDate,
        end_date: t.endDate,
        location: t.location || null,
        trade: t.trade || null,
      }));
      const { error: tErr } = await supabase.from("programme_reference_tasks").insert(rows);
      if (tErr) throw new Error(tErr.message);
    }

    // Build daily summaries — prefer AI, fall back to deterministic
    const aiByDate = new Map<string, string>();
    for (const d of parsed.dailySummaries ?? []) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.summary?.trim()) {
        aiByDate.set(d.date, d.summary.trim());
      }
    }

    // Range
    const starts = validTasks.map((t) => t.startDate).sort();
    const ends = validTasks.map((t) => t.endDate).sort();
    const first = parsed.projectStart && /^\d{4}-\d{2}-\d{2}$/.test(parsed.projectStart) ? parsed.projectStart : starts[0];
    const last = parsed.projectEnd && /^\d{4}-\d{2}-\d{2}$/.test(parsed.projectEnd) ? parsed.projectEnd : ends[ends.length - 1];

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
        const summary =
          aiByDate.get(date) ?? buildDeterministicSummary(date, validTasks);
        if (summary && summary !== "No scheduled activity on site for this date.") {
          playbookRows.push({
            project_id: data.projectId,
            programme_upload_id: up.id,
            playbook_date: date,
            ai_daily_summary: summary,
          });
        }
      }
    }

    // Wipe existing playbooks for this project and re-insert (one-shot compile)
    if (playbookRows.length) {
      await supabase
        .from("daily_programme_playbooks")
        .delete()
        .eq("project_id", data.projectId);
      const { error: pbErr } = await supabase
        .from("daily_programme_playbooks")
        .insert(playbookRows);
      if (pbErr) throw new Error(pbErr.message);
    }

    return {
      uploadId: up.id,
      taskCount: validTasks.length,
      dayCount: playbookRows.length,
      firstDate: playbookRows[0]?.playbook_date ?? null,
      lastDate: playbookRows[playbookRows.length - 1]?.playbook_date ?? null,
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
      .select("display_name, full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const authorName =
      (profile as { display_name?: string; full_name?: string; email?: string } | null)
        ?.display_name ??
      (profile as { full_name?: string } | null)?.full_name ??
      (profile as { email?: string } | null)?.email ??
      "Site Manager";

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
