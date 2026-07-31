/**
 * Global feature flags.
 *
 * BILLING_ENABLED — master switch for every billing / subscription surface
 * (billing route, pricing route, trial-ended route, pricing tiers, bespoke
 * upgrade modal, tier gating copy and all Stripe calls).
 *
 * While this is `false` the code stays in the repo but is completely
 * unreachable: routes render a plain "Not available" panel, no upgrade
 * prompts render anywhere, and no server function will touch Stripe.
 *
 * When it is flipped back to `true`, billing management additionally
 * requires the project_admin or master_admin role — enforced both
 * client-side (billing route) and server-side (subscriptions.functions.ts).
 */
export const BILLING_ENABLED = false;
