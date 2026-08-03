import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPromotable, tidyTypeLabel } from "@/lib/short-term-programme";

/**
 * Two-tier activity description library.
 *
 * Tier 1 — `project_activity_descriptions`: everything a user types, saved
 * automatically, full detail allowed (measurements, materials, locations).
 * RLS restricts reads to members of that one project, so nothing here is ever
 * visible from another project's picker.
 *
 * Tier 2 — `org_activity_types`: generic activity TYPES only, shared across
 * the org. Rows only ever arrive here through the opt-in promotion path, and
 * only after the deterministic guard AND a re-check of the AI's wording.
 */

export const listActivityOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: proj } = await (supabase.from("projects") as any)
      .select("org_id")
      .eq("id", data.projectId)
      .maybeSingle();

    const [{ data: projectRows }, orgRes] = await Promise.all([
      (supabase.from("project_activity_descriptions") as any)
        .select("id,label,created_at")
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(300),
      proj?.org_id
        ? (supabase.from("org_activity_types") as any)
            .select("id,label")
            .eq("org_id", proj.org_id)
            .order("label", { ascending: true })
            .limit(500)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    return {
      project: ((projectRows ?? []) as any[]).map((r) => ({ id: r.id, label: r.label as string })),
      shared: ((orgRes?.data ?? []) as any[]).map((r) => ({ id: r.id, label: r.label as string })),
    };
  });

/**
 * Save a typed activity to the project list immediately (never blocks), then
 * report back whether it is even eligible to be offered for the shared
 * library. Project-specific text is never sent to the model at all.
 */
export const saveProjectActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ projectId: z.string().uuid(), label: z.string().trim().min(2).max(300) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await (supabase.from("project_activity_descriptions") as any).insert({
      project_id: data.projectId,
      label: data.label,
      created_by: userId,
    });
    // A duplicate is a no-op, never an error the user has to deal with.
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);

    const gate = checkPromotable(data.label);
    if (!gate.promotable) return { saved: true as const, suggestion: null, reason: gate.reason };

    const { suggestGenericType } = await import("@/lib/short-term-programme.server");
    const suggestion = await suggestGenericType(data.label);
    return { saved: true as const, suggestion, reason: null };
  });

/** Opt-in promotion. Re-runs both guards server-side — the client cannot skip them. */
export const promoteActivityType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ projectId: z.string().uuid(), label: z.string().trim().min(4).max(60) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clean = tidyTypeLabel(data.label);
    const gate = checkPromotable(clean);
    if (!gate.promotable) {
      throw new Error(`That wording can't be shared across projects — it ${gate.reason}.`);
    }

    const { data: proj } = await (supabase.from("projects") as any)
      .select("org_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!proj?.org_id) throw new Error("This project has no organisation.");

    const { error } = await (supabase.from("org_activity_types") as any).insert({
      org_id: proj.org_id,
      label: clean,
      created_by: userId,
    });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { ok: true as const, label: clean };
  });
