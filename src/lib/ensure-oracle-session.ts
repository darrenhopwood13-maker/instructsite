import { supabase } from "@/integrations/supabase/client";

export async function ensureOracleSession() {
  const { data: existing, error: existingError } = await supabase.auth.getUser();
  if (existing?.user?.id && !existingError) return existing.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user?.id) {
    throw new Error(error?.message ?? "Could not start a secure Oracle session.");
  }

  return data.user;
}