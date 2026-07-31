/**
 * Shared display-name resolution for audit attribution (ISSUED BY, RECORDED BY).
 * Fallback chain: profiles.full_name -> auth user_metadata name -> email local-part.
 * Users that can't be resolved are simply absent from the map.
 */
export async function resolveUserNames(
  supabase: any,
  userIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (!ids.length) return names;

  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  for (const p of (profs ?? []) as any[]) {
    const n = (p.full_name ?? "").trim();
    if (n) names.set(p.user_id, n);
  }

  const missing = ids.filter((id) => !names.get(id));
  if (missing.length) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await Promise.all(
        missing.map(async (id) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
          const metaName =
            typeof meta.full_name === "string"
              ? meta.full_name.trim()
              : typeof meta.name === "string"
                ? meta.name.trim()
                : "";
          const email = u?.user?.email ?? "";
          const resolved = metaName || (email ? email.split("@")[0] : "");
          if (resolved) names.set(id, resolved);
        }),
      );
    } catch {
      // Admin lookup unavailable — leave unresolved ids out of the map.
    }
  }

  return names;
}
