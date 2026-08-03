/**
 * Programme vs live-progress variance model (pure, isomorphic).
 *
 * Inputs come from three places:
 *  - `programme_reference_tasks` — the imported baseline (planned dates)
 *  - `live_site_activity`        — DABS pin activity (what was actually manned)
 *  - `daily_site_diaries`        — close-out records; ONLY qs_status='approved'
 *                                  rows count as *verified* progress
 *
 * Everything here is deterministic so it can be unit tested; the AI note is
 * layered on top server-side and always has a deterministic fallback.
 */

export type VarianceTask = {
  id: string;
  taskRef: string | null;
  taskName: string;
  trade: string | null;
  location: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  predecessors: string[];
};

export type VariancePin = {
  id: string;
  tradePackage: string | null;
  zoneName: string | null;
  startTime: string;
  status: string;
  operativeCount: number;
};

export type VarianceDiary = {
  id: string;
  tradePackage: string | null;
  zoneName: string | null;
  checkoutTime: string;
  qsStatus: string;
  completionPct: number | null;
  managerCompletionPct: number | null;
  qsVerifiedPct: number | null;
};

export type PackageVariance = {
  key: string;
  label: string;
  taskIds: string[];
  tasks: VarianceTask[];
  plannedStart: string;
  plannedEnd: string;
  plannedPct: number;
  actualPct: number;
  daysVariance: number; // +behind, -ahead
  status: "ahead" | "on_track" | "behind" | "not_started" | "complete";
  downstreamRisk: boolean;
  riskFrom: string[];
  verifiedDiaryIds: string[];
  unverifiedDiaryCount: number;
  pinIds: string[];
  lastPinDate: string | null;
  lastVerifiedDiaryDate: string | null;
  note: string;
};

const DAY = 86_400_000;

export function toDay(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

const STOP = new Set([
  "and", "the", "to", "of", "with", "for", "fix", "works", "work", "zone", "site",
  "install", "installation", "phase", "level", "general", "&", "-",
]);

export function tokens(...parts: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    for (const raw of p.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 3 || STOP.has(raw)) continue;
      out.add(raw);
      // crude singularisation so "foundations" matches "foundation"
      if (raw.endsWith("s") && raw.length > 4) out.add(raw.slice(0, -1));
    }
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/** A record belongs to a package when it shares meaningful vocabulary with it. */
export function matchesPackage(pkgTokens: Set<string>, ...parts: Array<string | null | undefined>) {
  return overlap(pkgTokens, tokens(...parts)) > 0;
}

/**
 * Planned completion of a set of tasks at `today`, duration-weighted.
 * Each task contributes its own share of the package's total planned days.
 */
export function plannedPctAt(tasks: VarianceTask[], today: string): number {
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    const span = Math.max(1, diffDays(t.startDate, t.endDate) + 1);
    total += span;
    const elapsed = diffDays(t.startDate, today) + 1;
    done += Math.min(span, Math.max(0, elapsed));
  }
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

/**
 * Days ahead/behind = how far you have to slide the calendar for the planned
 * curve to equal what has actually been verified on site.
 */
export function daysVarianceFor(
  tasks: VarianceTask[],
  today: string,
  actualPct: number,
): number {
  if (tasks.length === 0) return 0;
  for (let offset = 0; offset <= 365; offset++) {
    // behind: the actual pct matches a *past* date
    if (plannedPctAt(tasks, addDays(today, -offset)) <= actualPct) return offset;
  }
  return 365;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/** Best verified figure on a diary: QS-verified beats manager beats subbie. */
export function verifiedPct(d: VarianceDiary): number {
  return d.qsVerifiedPct ?? d.managerCompletionPct ?? d.completionPct ?? 0;
}

export function isVerified(d: VarianceDiary): boolean {
  return d.qsStatus === "approved";
}

export function packageLabel(t: VarianceTask): string {
  return (t.trade?.trim() || t.taskName.split(/[-–—:]/)[0]?.trim() || "Unassigned").slice(0, 60);
}

export function buildVariance(input: {
  tasks: VarianceTask[];
  pins: VariancePin[];
  diaries: VarianceDiary[];
  today: string;
}): PackageVariance[] {
  const { tasks, pins, diaries, today } = input;

  // 1. Group baseline tasks into packages (programme "trade" is the package).
  const groups = new Map<string, VarianceTask[]>();
  for (const t of tasks) {
    const label = packageLabel(t);
    const key = label.toLowerCase();
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const byRef = new Map<string, VarianceTask>();
  for (const t of tasks) if (t.taskRef) byRef.set(t.taskRef, t);
  const packageOfTask = new Map<string, string>();
  for (const [key, arr] of groups) for (const t of arr) packageOfTask.set(t.id, key);

  const results: PackageVariance[] = [];

  for (const [key, group] of groups) {
    const label = packageLabel(group[0]);
    const pkgTokens = tokens(label, ...group.map((t) => `${t.taskName} ${t.location ?? ""}`));

    const pkgPins = pins.filter((p) => matchesPackage(pkgTokens, p.tradePackage, p.zoneName));
    const pkgDiaries = diaries.filter((d) =>
      matchesPackage(pkgTokens, d.tradePackage, d.zoneName),
    );
    const verified = pkgDiaries.filter(isVerified);

    // Latest verified figure per delivery stream (package + zone), averaged.
    const streams = new Map<string, VarianceDiary>();
    for (const d of verified) {
      const sk = `${d.tradePackage ?? ""}|${d.zoneName ?? ""}`;
      const prev = streams.get(sk);
      if (!prev || Date.parse(d.checkoutTime) > Date.parse(prev.checkoutTime)) streams.set(sk, d);
    }
    const streamPcts = [...streams.values()].map(verifiedPct);
    const actualPct =
      streamPcts.length > 0
        ? Math.round(streamPcts.reduce((a, b) => a + b, 0) / streamPcts.length)
        : 0;

    const plannedStart = group.map((t) => t.startDate).sort()[0];
    const plannedEnd = group.map((t) => t.endDate).sort().slice(-1)[0];
    const planned = plannedPctAt(group, today);

    let status: PackageVariance["status"];
    let daysVariance = 0;
    if (actualPct >= 100) {
      status = "complete";
    } else if (planned === 0) {
      status = "not_started";
    } else {
      daysVariance = daysVarianceFor(group, today, actualPct);
      if (actualPct > planned) {
        // ahead: how far forward the calendar must slide
        let offset = 0;
        while (offset < 365 && plannedPctAt(group, addDays(today, offset)) < actualPct) offset++;
        daysVariance = -offset;
      }
      status = daysVariance >= 2 ? "behind" : daysVariance <= -2 ? "ahead" : "on_track";
    }

    const lastPinDate = pkgPins
      .map((p) => toDay(p.startTime))
      .sort()
      .slice(-1)[0] ?? null;
    const lastVerifiedDiaryDate = verified
      .map((d) => toDay(d.checkoutTime))
      .sort()
      .slice(-1)[0] ?? null;

    results.push({
      key,
      label,
      taskIds: group.map((t) => t.id),
      tasks: group,
      plannedStart,
      plannedEnd,
      plannedPct: planned,
      actualPct,
      daysVariance,
      status,
      downstreamRisk: false,
      riskFrom: [],
      verifiedDiaryIds: verified.map((d) => d.id),
      unverifiedDiaryCount: pkgDiaries.length - verified.length,
      pinIds: pkgPins.map((p) => p.id),
      lastPinDate,
      lastVerifiedDiaryDate,
      note: "",
    });
  }

  // 2. Propagate downstream risk through the predecessor chains.
  const byKey = new Map(results.map((r) => [r.key, r]));
  const behindKeys = new Set(results.filter((r) => r.status === "behind").map((r) => r.key));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const t of tasks) {
      const ownKey = packageOfTask.get(t.id);
      if (!ownKey) continue;
      const own = byKey.get(ownKey);
      if (!own) continue;
      for (const predRef of t.predecessors ?? []) {
        const pred = byRef.get(predRef);
        const predKey = pred ? packageOfTask.get(pred.id) : undefined;
        if (!predKey || predKey === ownKey) continue;
        const upstreamAtRisk = behindKeys.has(predKey) || byKey.get(predKey)?.downstreamRisk;
        if (upstreamAtRisk && own.status !== "behind" && !own.riskFrom.includes(predKey)) {
          own.downstreamRisk = true;
          own.riskFrom.push(byKey.get(predKey)?.label ?? predKey);
          changed = true;
        }
      }
    }
  }

  return results.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
}

/** Deterministic position note — also the fallback when AI is unavailable. */
export function fallbackNote(p: PackageVariance, today: string): string {
  const bits: string[] = [];
  if (p.status === "complete") {
    bits.push(`${p.label} is signed off complete against the programme.`);
  } else if (p.status === "not_started") {
    bits.push(
      `${p.label} is not due to start until ${p.plannedStart} (${diffDays(today, p.plannedStart)} days away).`,
    );
  } else if (p.status === "behind") {
    bits.push(
      `${p.label} is ${p.daysVariance} day${p.daysVariance === 1 ? "" : "s"} behind programme — ${p.actualPct}% verified against ${p.plannedPct}% planned by today.`,
    );
  } else if (p.status === "ahead") {
    bits.push(
      `${p.label} is ${Math.abs(p.daysVariance)} days ahead — ${p.actualPct}% verified against ${p.plannedPct}% planned.`,
    );
  } else {
    bits.push(`${p.label} is tracking to programme at ${p.actualPct}% verified (${p.plannedPct}% planned).`);
  }

  if (p.verifiedDiaryIds.length === 0 && p.status !== "not_started") {
    bits.push("No QS-approved diary entries exist for this package yet, so progress is unevidenced.");
  } else if (p.lastVerifiedDiaryDate) {
    bits.push(`Last verified diary ${p.lastVerifiedDiaryDate}.`);
  }
  if (p.lastPinDate) bits.push(`Last DABS pin activity ${p.lastPinDate}.`);
  else if (p.status !== "not_started") bits.push("No pin activity recorded on site.");
  if (p.unverifiedDiaryCount > 0)
    bits.push(`${p.unverifiedDiaryCount} diary entr${p.unverifiedDiaryCount === 1 ? "y is" : "ies are"} awaiting QS verification.`);
  if (p.downstreamRisk) bits.push(`Downstream risk inherited from ${p.riskFrom.join(", ")}.`);
  return bits.join(" ");
}
