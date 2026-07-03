import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gpmdhxijzyxbddiqsxms.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_udH3T-UVjx7P16ziEVSWcg_1ZLOY0h_";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
