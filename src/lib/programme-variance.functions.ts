import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildVariance,
  fallbackNote,
  toDay,
  type PackageLinkMap,
  type PackageVariance,
  type VarianceDiary,
  type VariancePin,
  type VarianceTask,
} from "@/lib/programme-variance";

/**
 * Programme baseline vs live site progress for every package on a project.
 *
 * "Verified" progress means a daily_site_diaries row with qs_status =
 * 'approved'. Draft / pending / rejected close-outs are counted separately
 * as unevidenced and never move the completion figure.
 *
 * Package identity: explicit links in `programme_package_links` win; fuzzy
 * token overlap is only the fallback for projects that never set them.
 */
export const getProgrammeVariance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        today: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        withNotes: z.boolean().optional().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const today = data.today ?? new Date().toISOString().slice(0, 10);
    const { supabase } = context;

    const [
      { data: taskRows, error: tErr },
      { data: pinRows },
      { data: diaryRows },
      { data: linkRows },
    ] = await Promise.all([
      (supabase.from("programme_reference_tasks") as any)
        .select(
          "id, task_ref, task_name, trade, location, package_ref, start_date, end_date, predecessors",
        )
        .eq("project_id", data.projectId)
        .order("start_date", { ascending: true })
        .limit(1000),
      (supabase.from("live_site_activity") as any)
        .select("id, trade_package, start_time, status, operative_count, work_zones(name)")
        .eq("project_id", data.projectId)
        .order("start_time", { ascending: false })
        .limit(500),
      (supabase.from("daily_site_diaries") as any)
        .select(
          "id, trade_package, checkout_time, qs_status, completion_pct, manager_completion_pct, qs_verified_pct, zone_id, work_zones(name)",
        )
        .eq("project_id", data.projectId)
        .order("checkout_time", { ascending: false })
        .limit(500),
      (supabase.from("programme_package_links") as any)
        .select("source_label, package_key")
        .eq("project_id", data.projectId)
        .limit(500),
    ]);
    if (tErr) throw new Error(tErr.message);

    const tasks: VarianceTask[] = ((taskRows ?? []) as any[]).map((t) => ({
      id: t.id,
      taskRef: t.task_ref ?? null,
      taskName: t.task_name ?? "Task",
      trade: t.trade ?? null,
      location: t.location ?? null,
      packageRef: t.package_ref ?? null,
      startDate: t.start_date,
      endDate: t.end_date,
      predecessors: (t.predecessors ?? []) as string[],
    }));

    const pins: VariancePin[] = ((pinRows ?? []) as any[]).map((p) => ({
      id: p.id,
      tradePackage: p.trade_package ?? null,
      zoneName: p.work_zones?.name ?? null,
      startTime: p.start_time,
      status: p.status,
      operativeCount: p.operative_count ?? 0,
    }));

    const diaries: VarianceDiary[] = ((diaryRows ?? []) as any[]).map((d) => ({
      id: d.id,
      tradePackage: d.trade_package ?? null,
      zoneName: d.work_zones?.name ?? null,
      checkoutTime: d.checkout_time,
      qsStatus: d.qs_status,
      completionPct: d.completion_pct ?? null,
      managerCompletionPct: d.manager_completion_pct ?? null,
      qsVerifiedPct: d.qs_verified_pct ?? null,
    }));

    const links: PackageLinkMap = {};
    for (const l of (linkRows ?? []) as any[]) {
      links[String(l.source_label).toLowerCase()] = String(l.package_key).toLowerCase();
    }

    // Every distinct trade_package string in play, so the UI can offer a
    // one-tap "this belongs to that package" fix for anything mismatched.
    const sourceCounts = new Map<string, { label: string; pins: number; diaries: number }>();
    const bump = (label: string | null, kind: "pins" | "diaries") => {
      const clean = label?.trim();
      if (!clean) return;
      const k = clean.toLowerCase();
      const row = sourceCounts.get(k) ?? { label: clean, pins: 0, diaries: 0 };
      row[kind] += 1;
      sourceCounts.set(k, row);
    };
    for (const p of pins) bump(p.tradePackage, "pins");
    for (const d of diaries) bump(d.tradePackage, "diaries");

    if (tasks.length === 0) {
      return {
        today,
        hasBaseline: false as const,
        packages: [] as PackageVariance[],
        details: {},
        sources: [] as Array<{ label: string; pins: number; diaries: number; linkedTo: string | null }>,
      };
    }

    const packages = buildVariance({ tasks, pins, diaries, today, links });
    for (const p of packages) p.note = fallbackNote(p, today);

    if (data.withNotes) {
      try {
        const { writePositionNotes } = await import("@/lib/programme-variance.server");
        await writePositionNotes(packages, today);
      } catch (err) {
        console.error("[variance] AI note generation failed", err);
      }
    }

    // Drill-down detail: which pins / verified diaries back each package.
    const pinById = new Map(pins.map((p) => [p.id, p]));
    const diaryById = new Map(diaries.map((d) => [d.id, d]));
    const details: Record<
      string,
      { pins: VariancePin[]; diaries: VarianceDiary[]; tasks: VarianceTask[] }
    > = {};
    for (const p of packages) {
      details[p.key] = {
        pins: p.pinIds.map((id) => pinById.get(id)!).filter(Boolean).slice(0, 25),
        diaries: p.verifiedDiaryIds.map((id) => diaryById.get(id)!).filter(Boolean).slice(0, 25),
        tasks: p.tasks,
      };
    }

    const sources = [...sourceCounts.entries()]
      .map(([k, v]) => ({ ...v, linkedTo: links[k] ?? null }))
      .sort((a, b) => b.pins + b.diaries - (a.pins + a.diaries));

    return {
      today,
      hasBaseline: true as const,
      generatedAt: toDay(new Date()),
      packages,
      details,
      sources,
    };
  });

/**
 * Match (or unmatch) a diary / pin trade-package string to a programme
 * package. Two clicks from the variance panel — no settings page.
 */
export const setProgrammePackageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        sourceLabel: z.string().min(1).max(200),
        packageKey: z.string().min(1).max(120).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sourceLabel = data.sourceLabel.trim().toLowerCase();

    if (!data.packageKey) {
      const { error } = await (supabase.from("programme_package_links") as any)
        .delete()
        .eq("project_id", data.projectId)
        .eq("source_label", sourceLabel);
      if (error) throw new Error(error.message);
      return { ok: true as const, linked: null };
    }

    const packageKey = data.packageKey.trim().toLowerCase();
    const { error } = await (supabase.from("programme_package_links") as any).upsert(
      {
        project_id: data.projectId,
        source_label: sourceLabel,
        package_key: packageKey,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,source_label" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, linked: packageKey };
  });
