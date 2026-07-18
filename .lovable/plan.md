Add defensive env-var handling so the app stays at baseline when Stripe is missing and warns clearly when the service role key is missing.

## What will change
- `src/lib/subscriptions.functions.ts` — make the checkout flow degrade gracefully when Stripe env vars are absent.
- `src/routes/billing.$projectId.tsx` — handle the degraded checkout response with a friendly toast instead of throwing.
- `src/integrations/supabase/client.server.ts` — add a clear `console.warn` before the existing missing-service-role-key throw.
- Lovable Cloud secrets — add the missing env vars that are not already configured.

## Current state (verified by reading the files)
- `src/lib/access.ts` / `useProjectSubscription` calls `getProjectSubscription`, which already returns `tier: "baseline"` when no subscription row exists. The feature-access path therefore does not depend on Stripe env vars.
- The only Stripe env-var throw is in `createCheckoutSession` (`src/lib/subscriptions.functions.ts`), which throws if `STRIPE_SECRET_KEY` or the price IDs are missing.
- `src/integrations/supabase/client.server.ts` throws when `SUPABASE_SERVICE_ROLE_KEY` is missing, but without a preceding warning.
- Existing secrets: `LOVABLE_API_KEY`, `SITE_PASSWORD`, `SITE_GATE_SESSION_SECRET`, `STRIPE_*` are already set. Missing: `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SITE_URL`, `OWNER_EMAIL`, `DRAWING_TOKEN_SECRET`.

## Plan

### Fix A — Graceful Stripe fallback
1. In `src/lib/subscriptions.functions.ts`, update `createCheckoutSession`:
   - Check whether `STRIPE_SECRET_KEY` and the requested tier price env var are set.
   - If either is missing, `console.warn("[stripe] Stripe not configured — returning baseline tier fallback")`.
   - Return `{ url: null, tier: "baseline", status: "trialing", stripeConfigured: false }` instead of throwing.
2. In `src/routes/billing.$projectId.tsx`, update `handleSelect`:
   - After calling `createCheckoutSession`, if `res?.url` is present, redirect as before.
   - If `res?.stripeConfigured === false` (or `!res?.url`), show a toast info/error such as "Billing is not configured yet. You are on the Baseline plan." and stop loading.

### Fix B — Missing service role key warning
1. In `src/integrations/supabase/client.server.ts`, inside `createSupabaseAdminClient()`, add immediately before the existing throw:

   ```ts
   if (!SUPABASE_SERVICE_ROLE_KEY) {
     console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY not set — admin operations will fail. Set this in Lovable Cloud env vars.");
   }
   ```

   Keep the existing validation and throw unchanged.

### Secrets
Add the missing environment variables via the secure secrets tooling:
- `SUPABASE_SERVICE_ROLE_KEY` — open secure form for user-provided value.
- `PUBLIC_SITE_URL` — set to `https://instructsite.com`.
- `OWNER_EMAIL` — set to `darrenhopwood13@gmail.com`.
- `DRAWING_TOKEN_SECRET` — generate a random 32+ character secret.

Note: `LOVABLE_API_KEY`, `SITE_PASSWORD`, `SITE_GATE_SESSION_SECRET`, and `STRIPE_*` are already configured and will be left unchanged.

## Verification
- Run TypeScript typecheck after the code edits.
- Confirm the billing page still compiles and handles the new return shape.
- Confirm secrets are saved/listed as expected.