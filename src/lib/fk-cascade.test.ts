import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Regression guard for project deletion.
 *
 * Every foreign key pointing at public.projects must be ON DELETE CASCADE
 * (child data belongs to the project) or ON DELETE SET NULL (child survives
 * independently, e.g. snags). Anything else leaves orphans or makes the
 * delete fail outright.
 *
 * Runs only when service credentials are present (CI / local with env set);
 * skipped otherwise so the unit suite stays offline-safe.
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !key)("project delete cascade", () => {
  it("has no non-cascading foreign keys pointing at projects", async () => {
    const supabase = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("project_delete_cascade_gaps");
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});
