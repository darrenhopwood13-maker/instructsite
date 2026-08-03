import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { packageLabel, type VarianceTask } from "@/lib/programme-variance";

/**
 * The programme packages available for tagging on a project, grouped exactly
 * the same way the variance panel groups them (package_ref → trade → task
 * name prefix). Used to turn the freehand DABS trade_package field into a
 * real picker so entries are tagged correctly at source instead of being
 * reconciled later in FIX MATCHES.
 *
 * `hasBaseline` is false when no programme has been imported yet — callers
 * fall back to the freehand text field in that case.
 */
export const listProgrammePackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (
      context.supabase.from("programme_reference_tasks") as any
    )
      .select("id, task_ref, task_name, trade, location, package_ref, start_date, end_date")
      .eq("project_id", data.projectId)
      .limit(1000);

    if (error) throw new Error(error.message);

    const tasks = ((rows ?? []) as any[]).map(
      (t): VarianceTask => ({
        id: t.id,
        taskRef: t.task_ref ?? null,
        taskName: t.task_name,
        trade: t.trade ?? null,
        location: t.location ?? null,
        packageRef: t.package_ref ?? null,
        startDate: t.start_date,
        endDate: t.end_date,
        predecessors: [],
      }),
    );

    const groups = new Map<
      string,
      { key: string; label: string; taskCount: number; start: string; end: string }
    >();
    for (const t of tasks) {
      const label = packageLabel(t);
      const key = label.toLowerCase();
      const g = groups.get(key);
      if (!g) {
        groups.set(key, {
          key,
          label,
          taskCount: 1,
          start: t.startDate,
          end: t.endDate,
        });
      } else {
        g.taskCount += 1;
        if (t.startDate < g.start) g.start = t.startDate;
        if (t.endDate > g.end) g.end = t.endDate;
      }
    }

    const packages = [...groups.values()].sort((a, b) => a.start.localeCompare(b.start));
    return { hasBaseline: packages.length > 0, packages };
  });
