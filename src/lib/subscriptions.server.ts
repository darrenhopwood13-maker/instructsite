import { BILLING_ENABLED } from "@/config/features";

export const TIERS = ["baseline", "structure", "apex"] as const;

/** Hard stop for every billing surface while the feature flag is off. */
export function assertBillingEnabled() {
  if (!BILLING_ENABLED) {
    throw new Error("Billing is not available on this workspace.");
  }
}

/** True when the caller is a project admin or a platform master admin. */
export async function isBillingManager(
  supabase: any,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const { data: master } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "master_admin",
  });
  if (master) return true;
  const { data, error } = await supabase.rpc("is_project_admin", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

export async function assertProjectAdmin(
  supabase: any,
  projectId: string,
  userId: string,
) {
  if (!(await isBillingManager(supabase, projectId, userId))) {
    throw new Error("Project admin role required.");
  }
}
