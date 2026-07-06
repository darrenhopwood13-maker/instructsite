import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

const TaskSchema = z.object({
  taskName: z.string().default(""),
  plainEnglish: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  location: z.string().default(""),
  trade: z.string().default(""),
});

const ExtractedSchema = z.object({
  tasks: z.array(TaskSchema).default([]),
});

export const extractProgrammeWithRandall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        dataBase64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin gate
    const { data: isAdmin } = await supabase.rpc("is_project_admin", {
      _project_id: data.projectId,
      _user_id: userId,
    });
    if (!isAdmin) throw new Error("Forbidden: project admin required");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const isPdf = /pdf/i.test(data.mimeType);
    const isCsv = /csv|excel|spreadsheet|text\/plain/i.test(data.mimeType) || /\.csv$/i.test(data.fileName);
    if (!isPdf && !isCsv) {
      throw new Error("Unsupported file type. Upload a PDF or CSV programme.");
    }

    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;
    const promptText =
      "You are Randall, a construction programme translator. Read this construction programme (Gantt / task list). Extract EVERY task. For each task return: taskName (original), plainEnglish (a dummy-proof, plain English present-tense description of what the team should be doing — e.g. 'The team should be installing furniture and equipment on the first floor today.' — never use jargon like 'FF&E' or 'M&E 1st fix' without explaining it), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), location (floor/zone if inferable else empty), trade (if inferable else empty). If a date is missing or unreadable, skip the task rather than invent. Return only extractable tasks.";

    let extracted: z.infer<typeof ExtractedSchema>;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-pro"),
        output: Output.object({ schema: ExtractedSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "file", data: dataUrl, mediaType: data.mimeType, filename: data.fileName },
            ],
          },
        ],
      });
      extracted = output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const raw = error.text ?? "";
        let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start = cleaned.search(/[{[]/);
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.substring(start, end + 1);
        try {
          extracted = ExtractedSchema.parse(JSON.parse(cleaned));
        } catch {
          extracted = { tasks: [] };
        }
      } else {
        throw error;
      }
    }

    const validTasks = extracted.tasks.filter(
      (t) =>
        t.plainEnglish.trim() &&
        dateStr.safeParse(t.startDate).success &&
        dateStr.safeParse(t.endDate).success &&
        t.startDate <= t.endDate,
    );

    const { data: upload, error: upErr } = await supabase
      .from("programme_uploads")
      .insert({
        project_id: data.projectId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        uploaded_by: userId,
        task_count: validTasks.length,
      })
      .select("id")
      .single();
    if (upErr) throw new Error(upErr.message);

    if (validTasks.length > 0) {
      const rows = validTasks.map((t) => ({
        programme_upload_id: upload.id,
        project_id: data.projectId,
        task_name: t.taskName || t.plainEnglish.slice(0, 60),
        plain_english: t.plainEnglish,
        start_date: t.startDate,
        end_date: t.endDate,
        location: t.location || null,
        trade: t.trade || null,
      }));
      const { error: insErr } = await supabase.from("programme_reference_tasks").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { uploadId: upload.id, taskCount: validTasks.length };
  });

export const listProgrammeTasksForDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), date: dateStr }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("programme_reference_tasks")
      .select("id,task_name,plain_english,start_date,end_date,allowed_days,location,trade")
      .eq("project_id", data.projectId)
      .lte("start_date", data.date)
      .gte("end_date", data.date)
      .order("start_date", { ascending: true });
    if (error) throw new Error(error.message);

    const target = new Date(data.date + "T00:00:00Z").getTime();
    return (rows ?? []).map((r) => {
      const s = new Date(r.start_date + "T00:00:00Z").getTime();
      const daysIn = Math.floor((target - s) / 86400000) + 1;
      const allowed = r.allowed_days ?? 1;
      const elapsedPct = Math.max(0, Math.min(100, Math.round((daysIn / allowed) * 100)));
      return { ...r, day_number: daysIn, elapsed_pct: elapsedPct };
    });
  });

export const listManagerNotesForDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), date: dateStr }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("programme_manager_notes")
      .select("id,body,author_id,author_name,created_at,updated_at")
      .eq("project_id", data.projectId)
      .eq("note_date", data.date)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertManagerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        date: dateStr,
        body: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();
    const authorName = (prof?.full_name as string | undefined) ?? null;

    // One note per (project, date, author) — find existing
    const { data: existing } = await supabase
      .from("programme_manager_notes")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("note_date", data.date)
      .eq("author_id", userId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("programme_manager_notes")
        .update({ body: data.body, author_name: authorName })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }

    const { data: inserted, error } = await supabase
      .from("programme_manager_notes")
      .insert({
        project_id: data.projectId,
        note_date: data.date,
        author_id: userId,
        author_name: authorName,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteManagerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("programme_manager_notes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLatestProgrammeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("programme_uploads")
      .select("id,file_name,task_count,created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });
