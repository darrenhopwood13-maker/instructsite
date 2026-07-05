import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLE_VALUES = ["site_manager", "subcontractor", "apprentice", "qs"] as const;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("user_id, full_name, selected_role, trial_ends_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const initMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().max(200).optional(),
        selectedRole: z.enum(ROLE_VALUES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // upsert profile row (trial_ends_at auto-set by DB default on first insert)
    const { data: existing } = await context.supabase
      .from("profiles")
      .select("user_id, trial_ends_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) {
      const { error } = await context.supabase.from("profiles").insert({
        user_id: context.userId,
        full_name: data.fullName ?? null,
        selected_role: data.selectedRole,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("profiles")
        .update({ selected_role: data.selectedRole, full_name: data.fullName ?? null })
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }

    // Grant the selected role in user_roles (skip if privileged role already present)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const privileged = new Set(["master_admin", "project_admin"]);
    const hasPrivileged = (existingRoles ?? []).some((r: any) => privileged.has(r.role));
    if (!hasPrivileged) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: context.userId, role: data.selectedRole as any },
          { onConflict: "user_id,role" },
        );
    }
    return { ok: true };
  });
