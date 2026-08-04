/**
 * Private (personal) short-term programmes.
 *
 * Deliberately separate from `short_term_programmes`: that object is the
 * formal, dual-accepted, cap-counted, bible-filed agreement between a site
 * manager and a subcontractor PM, and its RLS (`stp_visible`) is company-wide
 * by design. A private programme is the opposite of all of that — one owner,
 * no counterpart, no acceptance, no lock, no filing — so it lives in its own
 * owner-only tables rather than weakening the shared ones.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normaliseTasks, type StpTask } from "@/lib/short-term-programme";

const TaskInput = z.object({
  taskName: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  packageLabel: z.string().trim().max(120).nullable().default(null),
  status: z.enum(["not_started", "in_progress", "at_risk", "done"]).default("not_started"),
});

export type PrivateTask = StpTask & { packageLabel: string | null };

function rowToTask(r: any): PrivateTask {
  return {
    id: r.id,
    seq: r.seq ?? 0,
    localRef: r.local_ref,
    taskName: r.task_name,
    startDate: r.start_date,
    endDate: r.end_date,
    predecessors: [],
    status: r.status,
    packageLabel: r.package_label ?? null,
  };
}

export const listPrivateProgrammes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase.from("private_programmes") as any)
      .select("id,title,packages,notes,created_at,updated_at,private_programme_tasks(id)")
      .eq("project_id", data.projectId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return {
      programmes: ((rows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        packages: (r.packages ?? []) as string[],
        notes: (r.notes ?? null) as string | null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        taskCount: (r.private_programme_tasks ?? []).length,
      })),
    };
  });

export const getPrivateProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ programmeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p, error } = await (supabase.from("private_programmes") as any)
      .select("*")
      .eq("id", data.programmeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Programme not found.");

    const { data: taskRows } = await (supabase.from("private_programme_tasks") as any)
      .select("*")
      .eq("programme_id", data.programmeId)
      .order("seq", { ascending: true });

    return {
      programme: {
        id: p.id as string,
        projectId: p.project_id as string,
        title: p.title as string,
        packages: (p.packages ?? []) as string[],
        notes: (p.notes ?? null) as string | null,
        createdAt: p.created_at as string,
        updatedAt: p.updated_at as string,
      },
      tasks: ((taskRows ?? []) as any[]).map(rowToTask),
    };
  });

export const createPrivateProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        packages: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
        notes: z.string().trim().max(4000).nullable().default(null),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase.from("private_programmes") as any)
      .insert({
        project_id: data.projectId,
        owner_user_id: context.userId,
        title: data.title,
        packages: data.packages,
        notes: data.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { programmeId: row.id as string };
  });

/** Full replace of the task list — the owner can change anything, any time. */
export const savePrivateProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        programmeId: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        packages: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
        notes: z.string().trim().max(4000).nullable().optional(),
        tasks: z.array(TaskInput).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.packages !== undefined) patch.packages = data.packages;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (Object.keys(patch).length > 0) {
      const { error } = await (supabase.from("private_programmes") as any)
        .update(patch)
        .eq("id", data.programmeId);
      if (error) throw new Error(error.message);
    }

    const tasks = normaliseTasks(data.tasks);
    const { error: dErr } = await (supabase.from("private_programme_tasks") as any)
      .delete()
      .eq("programme_id", data.programmeId);
    if (dErr) throw new Error(dErr.message);

    if (tasks.length > 0) {
      const { error: iErr } = await (supabase.from("private_programme_tasks") as any).insert(
        tasks.map((t, i) => ({
          programme_id: data.programmeId,
          seq: t.seq,
          local_ref: t.localRef,
          task_name: t.taskName,
          package_label: data.tasks[i]?.packageLabel ?? null,
          start_date: t.startDate,
          end_date: t.endDate,
          status: t.status,
        })),
      );
      if (iErr) throw new Error(iErr.message);
    }
    return { taskCount: tasks.length };
  });

export const deletePrivateProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ programmeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("private_programmes") as any)
      .delete()
      .eq("id", data.programmeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
