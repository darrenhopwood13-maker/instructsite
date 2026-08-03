import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildVariance,
  fallbackNote,
  toDay,
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

    const [{ data: taskRows, error: tErr }, { data: pinRows }, { data: diaryRows }] =
      await Promise.all([
        supabase
          .from("programme_reference_tasks")
          .select("id, task_ref, task_name, trade, location, start_date, end_date, predecessors")
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
      ]);
    if (tErr) throw new Error(tErr.message);

    const tasks: VarianceTask[] = ((taskRows ?? []) as any[]).map((t) => ({
      id: t.id,
      taskRef: t.task_ref ?? null,
      taskName: t.task_name ?? "Task",
      trade: t.trade ?? null,
      location: t.location ?? null,
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

    if (tasks.length === 0) {
      return { today, hasBaseline: false as const, packages: [] as PackageVariance[], details: {} };
    }

    const packages = buildVariance({ tasks, pins, diaries, today });
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

    return {
      today,
      hasBaseline: true as const,
      generatedAt: toDay(new Date()),
      packages,
      details,
    };
  });
