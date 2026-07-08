import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TIERS = ["baseline", "structure", "apex"] as const;

async function assertProjectAdmin(supabase: any, projectId: string, userId: string) {
  const { data, error } = await supabase.rpc("is_project_admin", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project admin role required.");
}

/**
 * Read the current subscription for a project. Any project member can read;
 * unknown/missing rows default to a baseline trial state.
 */
export const getProjectSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("project_subscriptions")
      .select(
        "tier, status, stripe_customer_id, current_period_end, cancel_at_period_end",
      )
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      return {
        tier: "baseline" as const,
        status: "trialing" as const,
        stripe_customer_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
      };
    }
    return row;
  });

/**
 * Kick off a Stripe Checkout session for the Baseline or Structure tier.
 * Apex is bespoke — use requestBespokeUpgrade instead.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        tier: z.enum(["baseline", "structure"]),
        returnUrl: z.string().url(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);

    const priceId =
      data.tier === "baseline"
        ? process.env.STRIPE_PRICE_BASELINE
        : process.env.STRIPE_PRICE_STRUCTURE;
    if (!priceId) {
      throw new Error(
        `Stripe price for ${data.tier} is not configured. Set STRIPE_PRICE_${data.tier.toUpperCase()}.`,
      );
    }
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured.");

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" as any });

    // Reuse a customer if we've seen one for this project
    const { data: existing } = await context.supabase
      .from("project_subscriptions")
      .select("stripe_customer_id")
      .eq("project_id", data.projectId)
      .maybeSingle();

    const email = (context.claims as any)?.email as string | undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : email,
      success_url: `${data.returnUrl}?checkout=success`,
      cancel_url: `${data.returnUrl}?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          project_id: data.projectId,
          tier: data.tier,
          initiated_by: context.userId,
        },
      },
      metadata: {
        project_id: data.projectId,
        tier: data.tier,
        initiated_by: context.userId,
      },
    });

    return { url: session.url };
  });

/**
 * Log an Apex bespoke upgrade request. Any project admin can submit; the
 * request lands in bespoke_upgrade_requests for the sales team to follow up.
 */
export const requestBespokeUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        featureKey: z.string().trim().max(80).optional(),
        contactName: z.string().trim().min(2).max(120),
        contactEmail: z.string().trim().email().max(200),
        contactPhone: z.string().trim().max(40).optional(),
        message: z.string().trim().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: row, error } = await context.supabase
      .from("bespoke_upgrade_requests")
      .insert({
        project_id: data.projectId,
        requested_by: context.userId,
        feature_key: data.featureKey ?? null,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone ?? null,
        message: data.message ?? null,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, createdAt: row.created_at };
  });

/**
 * Return the 1-admin / 2-read-only seat usage for a subcontractor company
 * on a given project.
 */
export const getSubcontractorSeatUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        companyName: z.string().trim().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "subcontractor_seat_usage" as never,
      {
        _project_id: data.projectId,
        _company_name: data.companyName,
      } as never,
    );
    if (error) throw new Error(error.message);
    const r = (rows as any[])?.[0];
    return {
      adminUsed: r?.admin_used ?? 0,
      readonlyUsed: r?.readonly_used ?? 0,
      adminCap: 1,
      readonlyCap: 2,
      totalCap: 3,
    };
  });

export const _tiers = TIERS;
