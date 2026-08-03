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
export async function renderProgrammePdf(input: {
  title: string;
  companyName: string;
  packageLabel: string;
  projectName: string;
  acceptedBySiteManager: string;
  acceptedBySubcontractor: string;
  tasks: StpTask[];
}): Promise<Uint8Array> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const m = 16;
  let y = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Short-Term Programme", m, y);
  y += 8;
  pdf.setFontSize(12);
  pdf.text(pdf.splitTextToSize(input.title, pageW - m * 2), m, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  for (const line of [
    `Project: ${input.projectName}`,
    `Subcontractor: ${input.companyName}`,
    `Package: ${input.packageLabel}`,
    `Accepted by site manager: ${input.acceptedBySiteManager}`,
    `Accepted by subcontractor PM: ${input.acceptedBySubcontractor}`,
    `Filed: ${new Date().toLocaleString()}`,
  ]) {
    pdf.text(line, m, y);
    y += 5;
  }
  pdf.setTextColor(0);
  y += 4;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Ref", m, y);
  pdf.text("Task", m + 14, y);
  pdf.text("Start", pageW - m - 46, y);
  pdf.text("Finish", pageW - m - 22, y);
  y += 5;
  pdf.setFont("helvetica", "normal");

  for (const t of input.tasks) {
    if (y > pageH - 20) {
      pdf.addPage();
      y = 20;
    }
    const name = pdf.splitTextToSize(t.taskName, pageW - m * 2 - 70);
    pdf.text(t.localRef, m, y);
    pdf.text(name, m + 14, y);
    pdf.text(t.startDate, pageW - m - 46, y);
    pdf.text(t.endDate, pageW - m - 22, y);
    y += Math.max(1, name.length) * 4.6 + 1.5;
  }

  return new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
}
