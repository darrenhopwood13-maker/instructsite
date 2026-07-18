Cache Supabase config in `auth-middleware.ts` to avoid re-reading env vars on every server function call.

## What will change
- `src/integrations/supabase/auth-middleware.ts` (auto-generated, but edits requested explicitly).
- Add module-level cache variables `_cachedUrl` and `_cachedKey`.
- Add a `getSupabaseConfig()` helper that populates the cache on first call.
- Replace the two inline `process.env` reads inside the middleware handler with a destructured call to `getSupabaseConfig()`.
- Leave validation, client creation, token parsing, and context injection unchanged.

## Plan
1. Add at the top of the file (after imports):

   ```ts
   let _cachedUrl: string | null = null;
   let _cachedKey: string | null = null;

   function getSupabaseConfig() {
     if (!_cachedUrl || !_cachedKey) {
       _cachedUrl = process.env.SUPABASE_URL ?? null;
       _cachedKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? null;
     }
     return { url: _cachedUrl, key: _cachedKey };
   }
   ```

2. Inside the `requireSupabaseAuth` middleware handler, replace:

   ```ts
   const SUPABASE_URL = process.env.SUPABASE_URL;
   const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
   ```

   with:

   ```ts
   const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = getSupabaseConfig();
   ```

3. Verify the build/typecheck passes and the middleware still rejects missing env vars as before.

## Notes
- No new imports or dependencies.
- No behaviour change; only reduces redundant env lookups per request.
- The file header says it is auto-generated, so this edit could be overwritten if the integration is regenerated. Given the request explicitly targets this file, we will apply the change directly.