import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook — verifies signature, syncs project_subscriptions.
 * Endpoint (public): /api/public/webhooks/stripe
 */
export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_SECRET_KEY;
        const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret || !whSecret) {
          return new Response("Stripe not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();

        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(secret, { apiVersion: "2024-06-20" as any });

        let event: any;
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            whSecret,
          );
        } catch (err) {
          return new Response(
            `Signature verification failed: ${(err as Error).message}`,
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const priceToTier = (priceId: string | null | undefined) => {
          if (!priceId) return null;
          if (priceId === process.env.STRIPE_PRICE_BASELINE) return "baseline";
          if (priceId === process.env.STRIPE_PRICE_STRUCTURE) return "structure";
          return null;
        };

        const statusMap: Record<string, string> = {
          trialing: "trialing",
          active: "active",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "past_due",
          incomplete: "incomplete",
          incomplete_expired: "canceled",
          paused: "past_due",
        };

        const upsertFromSubscription = async (sub: any, projectId?: string) => {
          const pid =
            projectId ?? sub?.metadata?.project_id ?? undefined;
          if (!pid) return;
          const priceId = sub.items?.data?.[0]?.price?.id ?? null;
          const tier = priceToTier(priceId) ?? "baseline";
          const status = statusMap[sub.status as string] ?? "incomplete";
          await supabaseAdmin
            .from("project_subscriptions")
            .upsert(
              {
                project_id: pid,
                tier,
                status,
                stripe_customer_id:
                  typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
                stripe_subscription_id: sub.id,
                stripe_price_id: priceId,
                current_period_end: sub.current_period_end
                  ? new Date(sub.current_period_end * 1000).toISOString()
                  : null,
                cancel_at_period_end: !!sub.cancel_at_period_end,
              },
              { onConflict: "project_id" },
            );
        };

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              const projectId = session?.metadata?.project_id as
                | string
                | undefined;
              if (session.subscription && projectId) {
                const sub = await stripe.subscriptions.retrieve(
                  session.subscription as string,
                );
                await upsertFromSubscription(sub, projectId);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await upsertFromSubscription(event.data.object);
              break;
            }
            default:
              // ignore
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
