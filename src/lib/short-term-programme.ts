/**
 * Short-term programme domain helpers (pure, isomorphic, unit tested).
 *
 * A short-term programme is a small standalone programme for one subcontractor
 * package added mid-project. It never reads from or writes to the master
 * baseline (`programme_reference_tasks`) — its tasks live in
 * `short_term_programme_tasks` and its refs are local to itself.
 */

import type { VarianceTask } from "@/lib/programme-variance";

export const STP_ACCEPTED_CAP = 5;

export type StpStatus = "draft" | "pending_acceptance" | "accepted";
export type StpTaskStatus = "not_started" | "in_progress" | "at_risk" | "done";
export type StpRole = "site_manager" | "subcontractor_pm";

export type StpTask = {
  id?: string;
  seq: number;
  localRef: string;
  taskName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  predecessors: string[];
  status: StpTaskStatus;
};

export const STP_TASK_STATUS_LABEL: Record<StpTaskStatus, string> = {
  not_started: "Not started",
  in_progress: "On track",
  at_risk: "At risk",
  done: "Done",
};

export const STP_STATUS_LABEL: Record<StpStatus, string> = {
  draft: "Draft",
  pending_acceptance: "Awaiting acceptance",
  accepted: "Accepted · locked",
};

const DAY = 86_400_000;

export function isoDay(d: Date | string): string {
  return (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);
}

export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** Duration in days, inclusive of both end dates (a 1-day task starts and ends the same day). */
export function durationOf(t: { startDate: string; endDate: string }): number {
  return Math.max(1, daysBetween(t.startDate, t.endDate) + 1);
}

/** Move the end date so the task lasts `days`, keeping the start where it is. */
export function withDuration<T extends { startDate: string; endDate: string }>(
  t: T,
  days: number,
): T {
  return { ...t, endDate: shiftDay(t.startDate, Math.max(1, Math.round(days)) - 1) };
}

/** Slide a whole task by n days, preserving its duration. */
export function slideTask<T extends { startDate: string; endDate: string }>(t: T, n: number): T {
  return { ...t, startDate: shiftDay(t.startDate, n), endDate: shiftDay(t.endDate, n) };
}

/** Local refs are simply the 1-based position — they never reference master tasks. */
export function localRefFor(index: number): string {
  return String(index + 1);
}

export function normaliseTasks(tasks: Array<Partial<StpTask>>): StpTask[] {
  return tasks
    .filter((t) => (t.taskName ?? "").trim().length > 0)
    .map((t, i) => {
      const start = t.startDate && /^\d{4}-\d{2}-\d{2}$/.test(t.startDate) ? t.startDate : isoDay(new Date());
      let end = t.endDate && /^\d{4}-\d{2}-\d{2}$/.test(t.endDate) ? t.endDate : start;
      if (daysBetween(start, end) < 0) end = start;
      return {
        ...(t.id ? { id: t.id } : {}),
        seq: i,
        localRef: localRefFor(i),
        taskName: t.taskName!.trim().slice(0, 200),
        startDate: start,
        endDate: end,
        predecessors: (t.predecessors ?? []).map((p) => String(p).trim()).filter(Boolean),
        status: (t.status ?? "not_started") as StpTaskStatus,
      };
    });
}

/**
 * Feed the existing variance engine with this mini-programme's tasks. Every
 * task is forced into a single package (the programme's own package label) so
 * `buildVariance` returns exactly one scoped result.
 */
export function toVarianceTasks(tasks: StpTask[], packageLabel: string): VarianceTask[] {
  return tasks.map((t) => ({
    id: t.id ?? t.localRef,
    taskRef: t.localRef,
    taskName: t.taskName,
    trade: packageLabel,
    location: null,
    packageRef: packageLabel,
    startDate: t.startDate,
    endDate: t.endDate,
    predecessors: t.predecessors,
  }));
}

// =========================================================
// ACTIVITY LIBRARY PRIVACY GUARD
// =========================================================

/**
 * Hard, deterministic gate deciding whether a typed activity description may
 * even be *considered* for the org-wide shared library.
 *
 * This is intentionally rules-first and conservative: anything numeric,
 * dimensional, branded or location-bearing is treated as project-identifying
 * and is never sent to the AI and never offered for promotion. A model is only
 * ever asked to reword text that has already cleared this gate.
 */
const UNIT_RE =
  /\b\d+\s*(mm|cm|m|m2|m²|m3|m³|sqm|sq\.?m|kg|t|tonnes?|mpa|kn|deg|°|%|in|ft|hrs?|hours?|no\.?)\b/i;
const LOCATION_RE =
  /\b(block|level|floor|storey|zone|plot|unit|grid|room|studio|apartment|apt|core|phase|wing|bay|stair|riser|plot)\b/i;
const BRANDISH_RE = /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b|®|™|\b[A-Z]{3,}\b/;

export type PromotionCheck =
  | { promotable: true }
  | { promotable: false; reason: string };

export function checkPromotable(label: string): PromotionCheck {
  const text = label.trim();
  if (text.length < 4) return { promotable: false, reason: "too short to be a reusable type" };
  if (text.length > 60) return { promotable: false, reason: "too specific (long description)" };
  if (text.split(/\s+/).length > 8) return { promotable: false, reason: "too specific (long description)" };
  if (/\d/.test(text)) return { promotable: false, reason: "contains numbers or measurements" };
  if (UNIT_RE.test(text)) return { promotable: false, reason: "contains measurements" };
  if (LOCATION_RE.test(text)) return { promotable: false, reason: "references a specific location" };
  if (BRANDISH_RE.test(text)) return { promotable: false, reason: "looks like a product or brand name" };
  return { promotable: true };
}

/**
 * Second guard, applied to whatever the AI proposes before it can be written
 * to the org-wide table. The model never gets the benefit of the doubt.
 */
export function isSafeGenericType(label: string): boolean {
  const text = label.trim();
  return (
    text.length >= 4 &&
    text.length <= 60 &&
    text.split(/\s+/).length <= 6 &&
    checkPromotable(text).promotable
  );
}

/** Title-case a generic activity type for consistent library entries. */
export function tidyTypeLabel(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s|\()([a-z])/g, (_m, p, c) => p + c.toUpperCase());
}
