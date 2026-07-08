import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import Papa from "papaparse";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// ---------------- Schemas ----------------

const TaskSchema = z.object({
  taskName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  trade: z.string().default(""),
  location: z.string().default(""),
});

const ExtractSchema = z.object({
  projectStart: z.string().default(""),
  projectEnd: z.string().default(""),
  tasks: z.array(TaskSchema).default([]),
});

type Task = z.infer<typeof TaskSchema>;

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

/** Parse many common date shapes into ISO YYYY-MM-DD; returns "" if unrecognisable. */
function normalizeDate(raw: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (isIso(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY (UK default for construction programmes)
  const uk = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (uk) {
    let [_, d, m, y] = uk;
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // 1-Aug-2025 / 01 Aug 2025 / August 1 2025
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
  };
  const m1 = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-,]+(\d{2,4})$/);
  if (m1) {
    const mo = months[m1[2].slice(0, 3).toLowerCase()];
    if (mo) {
      const y = m1[3].length === 2 ? (Number(m1[3]) > 50 ? "19" : "20") + m1[3] : m1[3];
      return `${y}-${mo}-${m1[1].padStart(2, "0")}`;
    }
  }
  const m2 = s.match(/^([A-Za-z]{3,9})[\s\-]+(\d{1,2})[\s\-,]+(\d{2,4})$/);
  if (m2) {
    const mo = months[m2[1].slice(0, 3).toLowerCase()];
    if (mo) {
      const y = m2[3].length === 2 ? (Number(m2[3]) > 50 ? "19" : "20") + m2[3] : m2[3];
      return `${y}-${mo}-${m2[2].padStart(2, "0")}`;
    }
  }
  // Last resort: Date.parse
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return toIso(new Date(t));
  return "";
}

// ---------------- Deterministic CSV parser ----------------

const NAME_KEYS = ["task", "task name", "activity", "activity name", "name", "description", "work", "operation"];
const START_KEYS = ["start", "start date", "startdate", "begin", "begin date", "planned start", "baseline start", "early start"];
const END_KEYS = ["end", "end date", "enddate", "finish", "finish date", "planned finish", "baseline finish", "early finish", "completion"];
const TRADE_KEYS = ["trade", "discipline", "contractor", "subcontractor", "resource", "responsibility"];
const LOC_KEYS = ["location", "zone", "area", "level", "floor", "wbs", "phase"];

function pickKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === cand);
    if (found) return found;
  }
  // partial match
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(cand));
    if (found) return found;
  }
  return null;
}

function parseCsvToTasks(text: string): Task[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  const rows = parsed.data ?? [];
  if (rows.length === 0) return [];

  const first = rows.find((r) => r && Object.keys(r).length > 0);
  if (!first) return [];
  const nameKey = pickKey(first, NAME_KEYS);
  const startKey = pickKey(first, START_KEYS);
  const endKey = pickKey(first, END_KEYS);
  if (!nameKey || !startKey || !endKey) return [];
  const tradeKey = pickKey(first, TRADE_KEYS);
  const locKey = pickKey(first, LOC_KEYS);

  const tasks: Task[] = [];
  for (const row of rows) {
    const name = String(row[nameKey] ?? "").trim();
    const start = normalizeDate(String(row[startKey] ?? ""));
    const end = normalizeDate(String(row[endKey] ?? ""));
    if (!name || !isIso(start) || !isIso(end)) continue;
    tasks.push({
      taskName: name,
      startDate: start,
      endDate: end < start ? start : end,
      trade: tradeKey ? String(row[tradeKey] ?? "").trim() : "",
      location: locKey ? String(row[locKey] ?? "").trim() : "",
    });
  }
  return tasks;
}

// ---------------- PDF text extraction ----------------

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  const t: unknown = text;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return (t as string[]).join("\n");
  return "";
}

// ---------------- AI extraction ----------------

function salvageJson<T extends z.ZodTypeAny>(schema: T, raw: string): z.infer<T> {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const s = cleaned.search(/[{\[]/);
  const e = cleaned.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try {
      return schema.parse(JSON.parse(cleaned.slice(s, e + 1)));
    } catch {
      // fall through
    }
  }
  return schema.parse({});
}

async function aiExtractFromText(
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
  text: string,
  signal: AbortSignal,
): Promise<z.infer<typeof ExtractSchema>> {
  const prompt =
    "You are Randall, an AI construction programme reader. Extract every dated task from the programme text below.\n\n" +
    "Rules:\n" +
    "- Return strictly the JSON schema.\n" +
    "- Every date must be ISO YYYY-MM-DD. Convert UK/US formats.\n" +
    "- taskName is the activity/work description.\n" +
    "- trade is the discipline (e.g. Groundworks, MEP, Drylining, Steelwork) — infer if not explicit.\n" +
    "- location is zone/level/area if given, else empty string.\n" +
    "- Skip summary/rollup rows that span the whole project.\n" +
    "- If no dated tasks, return tasks: [].\n\n" +
    "PROGRAMME TEXT:\n" +
    text;

  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-pro"),
      output: Output.object({ schema: ExtractSchema }),
      prompt,
      maxOutputTokens: 8192,
      abortSignal: signal,
    });
    try {
      return result.output;
    } catch {
      return salvageJson(ExtractSchema, result.text ?? "");
    }
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return salvageJson(ExtractSchema, err.text ?? "");
    }
    throw err;
  }
}

function chunkText(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChars));
    i += maxChars - overlap;
  }
  return chunks;
}

function mergeTasks(all: Task[]): Task[] {
  const seen = new Map<string, Task>();
  for (const t of all) {
    if (!t.taskName || !isIso(t.startDate) || !isIso(t.endDate)) continue;
    const key = `${t.taskName.toLowerCase()}|${t.startDate}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  return [...seen.values()];
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

    // Decode file
    const bin = atob(data.dataBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const isPdf = /pdf/i.test(data.mimeType) || /\.pdf$/i.test(data.fileName);
    const isCsv = /csv/i.test(data.mimeType) || /\.csv$/i.test(data.fileName) ||
      /text\/plain/i.test(data.mimeType);

    console.info("[Randall] compile start", {
      fileName: data.fileName,
      mimeType: data.mimeType,
      bytes: bytes.length,
      isPdf,
      isCsv,
    });

    let tasks: Task[] = [];
    let programmeText = "";

    // Strategy 1: CSV deterministic
    if (isCsv) {
      const text = new TextDecoder("utf-8").decode(bytes);
      tasks = parseCsvToTasks(text);
      console.info("[Randall] csv deterministic parse", { taskCount: tasks.length });
      programmeText = text;
    }

    // Strategy 2: PDF → text → AI (chunked if huge)
    if (!tasks.length && isPdf) {
      try {
        programmeText = await extractPdfText(bytes);
      } catch (err) {
        console.error("[Randall] pdf text extract failed", err);
        throw new Error("Randall could not read this PDF. Try exporting the programme as CSV.");
      }
      console.info("[Randall] pdf text extracted", { chars: programmeText.length });
    }

    // Strategy 3: fallback AI call over whatever text we have
    if (!tasks.length) {
      if (!programmeText || programmeText.trim().length < 30) {
        throw new Error("Randall couldn't read any task data from this file. Upload a CSV or a text-based PDF Gantt/task list.");
      }

      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Missing LOVABLE_API_KEY");
      const gateway = createLovableAiGatewayProvider(key);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);
      try {
        const chunks = chunkText(programmeText, 80_000, 4_000);
        console.info("[Randall] AI extract", { chunks: chunks.length });
        const results = await Promise.all(
          chunks.map((c) => aiExtractFromText(gateway, c, controller.signal)),
        );
        tasks = mergeTasks(results.flatMap((r) => r.tasks ?? []));
      } finally {
        clearTimeout(timer);
      }
      console.info("[Randall] AI extract done", { taskCount: tasks.length });
    }

    if (tasks.length === 0) {
      throw new Error(
        "Randall couldn't find any dated tasks. Expected a CSV/PDF with task name + start date + end date columns.",
      );
    }

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
    });

    return {
      uploadId: up.id,
      taskCount: tasks.length,
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
