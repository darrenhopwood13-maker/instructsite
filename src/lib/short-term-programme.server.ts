import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  checkPromotable,
  isSafeGenericType,
  normaliseTasks,
  shiftDay,
  tidyTypeLabel,
  type StpTask,
} from "@/lib/short-term-programme";

/**
 * AI Builder: turn a package plus a handful of described activities into a
 * sensible starting task list. The user tunes every date afterwards, so the
 * model only needs to get names, order and rough durations reasonable.
 *
 * Deterministic fallback: one task per activity, 3 working days each, in the
 * order the user picked them.
 */
export async function proposeTaskPlan(input: {
  packageLabel: string;
  activities: string[];
  startDate: string;
}): Promise<{ tasks: StpTask[]; source: "ai" | "fallback" }> {
  const fallback = () => {
    let cursor = input.startDate;
    const rows = input.activities.map((a, i) => {
      const start = cursor;
      const end = shiftDay(start, 2);
      cursor = shiftDay(end, 1);
      return {
        taskName: a,
        startDate: start,
        endDate: end,
        predecessors: i > 0 ? [String(i)] : [],
      };
    });
    return { tasks: normaliseTasks(rows), source: "fallback" as const };
  };

  const key = process.env["LOVABLE_API_KEY"];
  if (!key || input.activities.length === 0) return fallback();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "You are a UK construction planner producing a short-term (2-6 week) programme for one " +
        "subcontractor package. Break the described activities into a realistic ordered task list " +
        "with sensible durations in working days. Do not invent activities outside what is described, " +
        "though you may split one described activity into its obvious sequential stages. " +
        "Never mention people, costs, or other packages.",
      prompt:
        `Package: ${input.packageLabel}\nStart date: ${input.startDate}\n` +
        `Activities described by the site team:\n${input.activities.map((a) => `- ${a}`).join("\n")}\n\n` +
        `Return one JSON object only, no prose: ` +
        `{"tasks":[{"taskName":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","predecessors":["1"]}]}. ` +
        `Sequence tasks from the start date, Monday-Friday only, no task longer than 10 days, ` +
        `maximum 20 tasks. predecessors refer to the 1-based position of earlier tasks in this list.`,
      maxOutputTokens: 4096,
      abortSignal: controller.signal,
    });

    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return fallback();
    const parsed = JSON.parse(match[0]) as { tasks?: Array<Partial<StpTask>> };
    const tasks = normaliseTasks(parsed.tasks ?? []);
    if (tasks.length === 0) return fallback();
    return { tasks: tasks.slice(0, 20), source: "ai" };
  } catch (err) {
    console.warn("[stp] AI builder falling back to deterministic plan:", err);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Propose a clean, generic activity *type* for the org-wide shared library.
 *
 * The deterministic guard in `checkPromotable` runs BEFORE this is ever
 * called, so no project-identifying text is sent to the model. Whatever comes
 * back is re-checked by `isSafeGenericType` before it can be offered — the
 * model can only ever narrow, never widen, what is allowed through.
 */
export async function suggestGenericType(label: string): Promise<string | null> {
  if (!checkPromotable(label).promotable) return null;
  const key = process.env["LOVABLE_API_KEY"];
  const naive = tidyTypeLabel(label);
  if (!key) return isSafeGenericType(naive) ? naive : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "You normalise UK construction activity descriptions into short generic activity TYPES for a " +
        "shared library. Output 2-4 words, title case, no measurements, no product or brand names, " +
        "no locations, no numbers. If the input cannot be made generic, output NONE.",
      prompt: `Input: ${label}\nOutput the generic type only.`,
      maxOutputTokens: 32,
      abortSignal: controller.signal,
    });
    const out = tidyTypeLabel(result.text.replace(/["`\n]/g, " ").trim());
    if (!out || /^none$/i.test(out)) return null;
    return isSafeGenericType(out) ? out : null;
  } catch (err) {
    console.warn("[stp] generic type suggestion failed:", err);
    return isSafeGenericType(naive) ? naive : null;
  } finally {
    clearTimeout(timer);
  }
}

/** A4 PDF of an accepted short-term programme, filed into the project bible. */
/**
 * Rendered with pdf-lib, not jsPDF: this runs inside the edge worker on
 * acceptance, where jsPDF's UMD bundle fails with "jsPDF is not a constructor".
 */
export async function renderProgrammePdf(input: {
  title: string;
  companyName: string;
  packageLabel: string;
  projectName: string;
  acceptedBySiteManager: string;
  acceptedBySubcontractor: string;
  tasks: StpTask[];
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);

  const pageW = 595.28;
  const pageH = 841.89;
  const m = 45;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - 56;

  // pdf-lib's WinAnsi fonts reject characters like the em dash and middot.
  const safe = (s: string) =>
    String(s ?? "")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u00b7/g, "-")
      .replace(/[^\x20-\x7E]/g, " ");

  const wrap = (text: string, font: typeof body, size: number, width: number) => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const draw = (
    text: string,
    x: number,
    size: number,
    font: typeof body,
    grey = false,
  ) => {
    page.drawText(safe(text), {
      x,
      y,
      size,
      font,
      color: grey ? rgb(0.42, 0.42, 0.42) : rgb(0, 0, 0),
    });
  };

  draw("Short-Term Programme", m, 18, bold);
  y -= 22;
  for (const line of wrap(input.title, bold, 13, pageW - m * 2)) {
    draw(line, m, 13, bold);
    y -= 17;
  }
  y -= 6;

  for (const line of [
    `Project: ${input.projectName}`,
    `Subcontractor: ${input.companyName}`,
    `Package: ${input.packageLabel}`,
    `Accepted by site manager: ${input.acceptedBySiteManager}`,
    `Accepted by subcontractor PM: ${input.acceptedBySubcontractor}`,
    `Filed: ${new Date().toISOString()}`,
  ]) {
    draw(line, m, 9, body, true);
    y -= 13;
  }
  y -= 10;

  const startX = pageW - m - 130;
  const endX = pageW - m - 62;
  draw("Ref", m, 10, bold);
  draw("Task", m + 34, 10, bold);
  draw("Start", startX, 10, bold);
  draw("Finish", endX, 10, bold);
  y -= 6;
  page.drawLine({
    start: { x: m, y },
    end: { x: pageW - m, y },
    thickness: 0.6,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 14;

  for (const t of input.tasks) {
    const lines = wrap(t.taskName, body, 10, startX - m - 44);
    if (y - lines.length * 13 < 50) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - 56;
    }
    draw(t.localRef, m, 10, body);
    draw(t.startDate, startX, 10, body);
    draw(t.endDate, endX, 10, body);
    for (const line of lines) {
      draw(line, m + 34, 10, body);
      y -= 13;
    }
    y -= 3;
  }

  return await doc.save();
}

