import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const managerForceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        pinId: z.string().uuid(),
        completionPct: z.number().int().min(0).max(100),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: diaryId, error } = await context.supabase.rpc(
      "manager_force_checkout" as never,
      {
        _pin_id: data.pinId,
        _completion_pct: data.completionPct,
        _notes: data.notes ?? "",
      } as never,
    );
    if (error) throw new Error(error.message);
    return { diaryId: diaryId as unknown as string };
  });
