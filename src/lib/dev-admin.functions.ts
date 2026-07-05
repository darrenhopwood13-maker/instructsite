import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const claimMasterAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "dev_claim_master_admin",
      { _project_id: data.projectId ?? null },
    );
    if (error) throw new Error(error.message);
    return result;
  });
