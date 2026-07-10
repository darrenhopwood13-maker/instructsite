import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import Papa from "papaparse";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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

export type ProgrammeTask = z.infer<typeof TaskSchema>;

export type ProgrammeCompileResult = {
  tasks: ProgrammeTask[];
  source: "csv" | "xer" | "xml" | "pdf-text" | "pdf-vision" | "text" | "ai";
};

export type ProgrammePlaybookRow = {
  project_id: string;
  programme_upload_id: string;
  playbook_date: string;
  ai_daily_summary: string;
};

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

function normalizeDate(raw: string): string {
  if (!raw) return "";
  const s = String(raw)
    .trim()
    .replace(/^(?:mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\s+/i, "")
    .replace(/,$/, "");
  if (!s) return "";

  const isoPrefix = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoPrefix) {
    return `${isoPrefix[1]}-${isoPrefix[2].padStart(2, "0")}-${isoPrefix[3].padStart(2, "0")}`;
  }

  const excelSerial = s.match(/^\d{5}(?:\.\d+)?$/);
  if (excelSerial) {
    const serial = Number(s);
    if (serial > 20_000 && serial < 80_000) {
      const d = new Date(Date.UTC(1899, 11, 30));
      d.setUTCDate(d.getUTCDate() + Math.floor(serial));
      return toIso(d);
    }
  }

  const uk = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (uk) {
    let [, d, m, y] = uk;
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

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

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return toIso(new Date(t));
  return "";
}

const NAME_KEYS = ["task", "task name", "activity", "activity name", "name", "description", "work", "operation", "task_name"];
const START_KEYS = ["start", "start date", "startdate", "begin", "begin date", "planned start", "baseline start", "early start", "target start", "start_date"];
const END_KEYS = ["end", "end date", "enddate", "finish", "finish date", "planned finish", "baseline finish", "early finish", "target finish", "completion", "end_date", "finish_date"];
const TRADE_KEYS = ["trade", "discipline", "contractor", "subcontractor", "resource", "responsibility", "role"];
const LOC_KEYS = ["location", "zone", "area", "level", "floor", "wbs", "phase", "block", "plot"];

function pickKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === cand);
    if (found) return found;
  }
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(cand));
    if (found) return found;
  }
  return null;
}

function inferTrade(name: string): string {
  const n = name.toLowerCase();
  const trades: [string, string[]][] = [
    ["Groundworks", ["ground", "excavat", "drain", "duct", "foundation", "slab", "substructure", "piling"]],
    ["Concrete", ["concrete", "pour", "formwork", "rebar", "rc frame"]],
    ["Steelwork", ["steel", "frame", "beam", "column", "decking"]],
    ["Envelope", ["roof", "clad", "curtain", "window", "facade", "façade", "brick"]],
    ["MEP", ["mep", "mechanical", "electrical", "plumb", "hvac", "sprinkler", "containment", "commission"]],
    ["Drylining", ["drylin", "partition", "plasterboard", "ceiling", "skim"]],
    ["Fit-out", ["fit out", "fit-out", "joinery", "floor finish", "decorate", "paint", "tiling"]],
    ["External Works", ["external", "landscap", "paving", "kerb", "road", "car park"]],
  ];
  return trades.find(([, keys]) => keys.some((k) => n.includes(k)))?.[0] ?? "General";
}

function inferLocation(name: string): string {
  const match = name.match(/\b(?:block|zone|area|level|lvl|floor|plot|phase|core|stair)\s*[A-Z0-9][A-Z0-9\-/.]*/i);
  return match?.[0]?.trim() ?? "";
}

function cleanTaskName(raw: string): string {
  return raw
    .replace(/\b(?:start|finish|end|duration|dur|activity id|task mode|baseline|early|late|planned|actual)\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:d|day|days|w|wk|week|weeks|hrs?|hours?)\b/gi, " ")
    .replace(/\b\d{1,3}%\b/g, " ")
    .replace(/^[\s\d.#\-–—_:|/\\]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function validTask(t: ProgrammeTask): boolean {
  if (!t.taskName || t.taskName.length < 3) return false;
  if (!isIso(t.startDate) || !isIso(t.endDate)) return false;
  if (t.startDate < "1990-01-01" || t.startDate > "2100-01-01") return false;
  return true;
}

function normaliseTask(t: ProgrammeTask): ProgrammeTask | null {
  const start = normalizeDate(t.startDate);
  const end = normalizeDate(t.endDate);
  const name = cleanTaskName(t.taskName);
  const task = {
    taskName: name,
    startDate: start,
    endDate: end && end < start ? start : end,
    trade: (t.trade || inferTrade(name)).trim(),
    location: (t.location || inferLocation(name)).trim(),
  };
  return validTask(task) ? task : null;
}

function mergeTasks(all: ProgrammeTask[]): ProgrammeTask[] {
  const seen = new Map<string, ProgrammeTask>();
  for (const raw of all) {
    const t = normaliseTask(raw);
    if (!t) continue;
    const key = `${t.taskName.toLowerCase()}|${t.startDate}|${t.endDate}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  return [...seen.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function parseCsvToTasks(text: string): ProgrammeTask[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  const rows = parsed.data ?? [];
  const first = rows.find((r) => r && Object.keys(r).some((k) => String(r[k] ?? "").trim()));
  if (!first) return [];
  const nameKey = pickKey(first, NAME_KEYS);
  const startKey = pickKey(first, START_KEYS);
  const endKey = pickKey(first, END_KEYS);
  if (!nameKey || !startKey || !endKey) return [];
  const tradeKey = pickKey(first, TRADE_KEYS);
  const locKey = pickKey(first, LOC_KEYS);

  return mergeTasks(rows.map((row) => {
    const name = String(row[nameKey] ?? "").trim();
    return {
      taskName: name,
      startDate: String(row[startKey] ?? ""),
      endDate: String(row[endKey] ?? ""),
      trade: tradeKey ? String(row[tradeKey] ?? "").trim() : inferTrade(name),
      location: locKey ? String(row[locKey] ?? "").trim() : inferLocation(name),
    };
  }));
}

const DATE_RE = /(\d{4}-\d{1,2}-\d{1,2}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[A-Za-z]*[\s\-,]\d{2,4})/gi;

function dateMatches(line: string): { raw: string; iso: string; index: number }[] {
  const matches: { raw: string; iso: string; index: number }[] = [];
  for (const m of line.matchAll(DATE_RE)) {
    const raw = m[0];
    const iso = normalizeDate(raw);
    if (iso && !matches.some((x) => x.index === m.index && x.iso === iso)) {
      matches.push({ raw, iso, index: m.index ?? 0 });
    }
  }
  return matches;
}

function taskNameFromLine(line: string, dates: { raw: string; index: number }[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const before = cleanTaskName(line.slice(0, first.index));
  const after = cleanTaskName(line.slice(last.index + last.raw.length));
  const between = cleanTaskName(line.slice(first.index + first.raw.length, last.index));
  const candidates = [before, after, between].filter((s) => s.length >= 3 && !dateMatches(s).length);
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? "Programme activity";
}

function parseFreeTextToTasks(text: string): ProgrammeTask[] {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((l) => !/^page\s+\d+/i.test(l));

  const tasks: ProgrammeTask[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let span = 1; span <= 4 && i + span <= lines.length; span++) {
      const combined = lines.slice(i, i + span).join(" ");
      const dates = dateMatches(combined);
      if (dates.length < 2) continue;
      const name = taskNameFromLine(combined, dates);
      if (/^(start|finish|end|duration|date|programme activity)$/i.test(name)) continue;
      tasks.push({
        taskName: name,
        startDate: dates[0].iso,
        endDate: dates[dates.length - 1].iso,
        trade: inferTrade(name),
        location: inferLocation(name),
      });
      break;
    }
  }
  return mergeTasks(tasks);
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
}

function parseXmlToTasks(text: string): ProgrammeTask[] {
  if (!/<Task[>\s]/i.test(text)) return [];
  const tasks: ProgrammeTask[] = [];
  for (const m of text.matchAll(/<Task[>\s][\s\S]*?<\/Task>/gi)) {
    const block = m[0];
    if (/<Summary>\s*1\s*<\/Summary>/i.test(block)) continue;
    const name = tag(block, "Name");
    const start = tag(block, "Start") || tag(block, "BaselineStart");
    const finish = tag(block, "Finish") || tag(block, "BaselineFinish");
    if (name && start && finish) {
      tasks.push({ taskName: name, startDate: start, endDate: finish, trade: inferTrade(name), location: inferLocation(name) });
    }
  }
  return mergeTasks(tasks);
}

function parseXerToTasks(text: string): ProgrammeTask[] {
  if (!text.includes("%T") || !text.includes("TASK")) return [];
  let table = "";
  let fields: string[] = [];
  const tasks: ProgrammeTask[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts[0] === "%T") {
      table = parts[1] ?? "";
      fields = [];
    } else if (parts[0] === "%F" && table === "TASK") {
      fields = parts.slice(1);
    } else if (parts[0] === "%R" && table === "TASK" && fields.length) {
      const row = Object.fromEntries(fields.map((f, idx) => [f, parts[idx + 1] ?? ""]));
      const name = row.task_name || row.task_code || row.task_id || "";
      const start = row.start_date || row.early_start_date || row.target_start_date || row.act_start_date;
      const end = row.end_date || row.early_end_date || row.target_end_date || row.act_end_date || row.restart_date;
      if (name && start && end) {
        tasks.push({ taskName: name, startDate: start, endDate: end, trade: inferTrade(name), location: inferLocation(name) });
      }
    }
  }
  return mergeTasks(tasks);
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  const t: unknown = text;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return (t as string[]).join("\n");
  return "";
}

function salvageJson(raw: string): z.infer<typeof ExtractSchema> {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\[{]/);
  const endObj = cleaned.lastIndexOf("}");
  const endArr = cleaned.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(parsed) ? ExtractSchema.parse({ tasks: parsed }) : ExtractSchema.parse(parsed);
    } catch {
      // fall through
    }
  }
  return ExtractSchema.parse({});
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
}

async function aiExtractFromText(text: string): Promise<ProgrammeTask[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return [];
  const gateway = createLovableAiGatewayProvider(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);
  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      output: Output.object({ schema: ExtractSchema }),
      system: "You are a construction programme parser. Extract scheduled tasks only, ignoring headers and non-task lines.",
      prompt:
        "Extract construction programme activities from the text below. Return only dated work tasks with taskName, startDate, endDate, trade, and location. Dates must be ISO YYYY-MM-DD. Skip headings, summaries, blank rows, and metadata.\n\n---\n\n" +
        text.slice(0, 45_000),
      maxOutputTokens: 4096,

      abortSignal: controller.signal,
    });
    return mergeTasks(result.output.tasks ?? []);
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return mergeTasks(salvageJson(err.text ?? "").tasks ?? []);
    }
    if (NoOutputGeneratedError.isInstance(err)) {
      console.warn("[Randall] AI fallback returned no output");
      return [];
    }
    if (isAbortError(err)) {
      console.warn("[Randall] AI fallback timed out; deterministic parsers already attempted");
      return [];
    }
    console.error("[Randall] AI fallback failed", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function aiExtractFromPdf(bytes: Uint8Array, fileName: string): Promise<ProgrammeTask[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return [];
  const gateway = createLovableAiGatewayProvider(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const result = await generateText({
      model: gateway("google/gemini-2.5-pro"),
      output: Output.object({ schema: ExtractSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are reading a construction programme (Gantt chart) PDF. Extract every real scheduled activity. " +
                "Rules: (1) taskName is the row label as printed. " +
                "(2) startDate and endDate MUST be ISO YYYY-MM-DD — infer year from the chart's date axis; if only month/day is visible, use the year from the header or title block. " +
                "(3) Skip summary/rollup rows, section headers, legends, and zero-duration milestones unless they have an explicit date. " +
                "(4) trade and location only if visibly labelled in a column; otherwise leave empty. " +
                "(5) If this PDF is not a programme/schedule, return {\"tasks\": []}. " +
                "Return strict JSON matching the schema. No prose.",
            },
            {
              type: "file",
              data: bytes,
              mediaType: "application/pdf",
              filename: fileName,
            },
          ],
        },
      ],

      maxOutputTokens: 16384,
      abortSignal: controller.signal,
    });

    return mergeTasks(result.output.tasks ?? []);
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return mergeTasks(salvageJson(err.text ?? "").tasks ?? []);
    }
    if (NoOutputGeneratedError.isInstance(err)) {
      console.warn("[Randall] PDF vision fallback returned no output");
      return [];
    }
    if (isAbortError(err)) {
      console.warn("[Randall] PDF vision fallback timed out");
      return [];
    }
    console.error("[Randall] PDF vision fallback failed", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64(dataBase64: string): Uint8Array {
  const bin = atob(dataBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function compileProgrammeFile(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Promise<ProgrammeCompileResult> {
  const bytes = decodeBase64(input.dataBase64);
  const lowerName = input.fileName.toLowerCase();
  const isPdf = /pdf/i.test(input.mimeType) || lowerName.endsWith(".pdf");
  const isCsv = /csv|text\/plain|tab-separated/i.test(input.mimeType) || /\.(csv|tsv|txt)$/i.test(lowerName);
  const isXml = /xml/i.test(input.mimeType) || lowerName.endsWith(".xml");
  const isXer = lowerName.endsWith(".xer");

  console.info("[Randall] compile start", {
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: bytes.length,
    isPdf,
    isCsv,
    isXml,
    isXer,
  });

  let text = "";
  let tasks: ProgrammeTask[] = [];

  if (isPdf) {
    try {
      text = await extractPdfText(bytes);
      console.info("[Randall] pdf text extracted", { chars: text.length });
      tasks = parseFreeTextToTasks(text);
      // Guard against visual Gantt PDFs whose only text is a month/year
      // scale — those tend to produce 0-2 bogus "tasks" from axis labels.
      if (tasks.length >= 3) return { tasks, source: "pdf-text" };

      // Try AI on the extracted text if we have any.
      if (text.trim().length > 100) {
        const aiTasks = await aiExtractFromText(text);
        if (aiTasks.length >= 3) return { tasks: aiTasks, source: "ai" };
      }

      // Visual Gantt PDFs often expose almost no usable text. In that case,
      // pass the PDF itself to a multimodal model so bars + date axes can be read.
      const visualTasks = await aiExtractFromPdf(bytes, input.fileName);
      if (visualTasks.length >= 3) return { tasks: visualTasks, source: "pdf-vision" };

      console.warn("[Randall] PDF did not contain enough dated task rows", {
        textTasks: tasks.length,
        visualTasks: visualTasks.length,
      });
      return { tasks: [], source: "pdf-vision" };
    } catch (err) {
      console.error("[Randall] pdf text extract failed", err);
      return { tasks: [], source: "pdf-text" };
    }
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  if (!text.trim()) {
    throw new Error("Randall could not read text from this file. Export the programme as CSV, XML, XER, TXT, or a text-based PDF.");
  }

  if (isXer) {
    tasks = parseXerToTasks(text);
    if (tasks.length) return { tasks, source: "xer" };
  }

  if (isXml) {
    tasks = parseXmlToTasks(text);
    if (tasks.length) return { tasks, source: "xml" };
  }

  if (isCsv) {
    tasks = parseCsvToTasks(text);
    if (tasks.length) return { tasks, source: "csv" };
  }

  tasks = parseFreeTextToTasks(text);
  if (tasks.length) return { tasks, source: "text" };

  tasks = await aiExtractFromText(text);
  if (tasks.length) return { tasks, source: "ai" };

  throw new Error("Randall could not find dated activities. Upload a task export with activity name plus start and finish dates, or export the programme as CSV/XML/XER.");
}

function buildRichSummary(date: string, tasks: ProgrammeTask[]): string {
  const active = tasks.filter((t) => t.startDate <= date && date <= t.endDate);
  if (active.length === 0) return "";

  const starts = active.filter((t) => t.startDate === date);
  const ends = active.filter((t) => t.endDate === date);

  const byTrade = new Map<string, ProgrammeTask[]>();
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

  const locGroups = new Map<string, ProgrammeTask[]>();
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

export function buildProgrammePlaybookRows(input: {
  projectId: string;
  uploadId: string;
  tasks: ProgrammeTask[];
}): ProgrammePlaybookRow[] {
  const starts = input.tasks.map((t) => t.startDate).sort();
  const ends = input.tasks.map((t) => t.endDate).sort();
  const first = starts[0];
  const last = ends[ends.length - 1];
  const rows: ProgrammePlaybookRow[] = [];

  if (!first || !last) return rows;

  const total = Math.min(400, diffDays(first, last) + 1);
  for (let i = 0; i < total; i++) {
    const date = addDays(first, i);
    const summary = buildRichSummary(date, input.tasks);
    if (summary) {
      rows.push({
        project_id: input.projectId,
        programme_upload_id: input.uploadId,
        playbook_date: date,
        ai_daily_summary: summary,
      });
    }
  }
  return rows;
}
