// Turns whatever a server function throws (Error, Response-ish object,
// serialised RPC payload) into a short, human-readable message we can toast.
// A user must never lose work silently — every mutation should surface this.
export function errorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (!e) return fallback;
  let raw = "";
  if (typeof e === "string") raw = e;
  else if (e instanceof Error) raw = e.message;
  else {
    const anyE = e as Record<string, unknown>;
    raw = String(anyE.message ?? anyE.error ?? anyE.statusText ?? "");
  }
  raw = raw.trim();
  if (!raw || raw === "[object Object]" || raw === "[object Response]") return fallback;

  // Server functions sometimes surface the error as a JSON blob.
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      const inner = parsed?.message ?? parsed?.error?.message ?? parsed?.error;
      if (typeof inner === "string" && inner.trim()) raw = inner.trim();
    } catch {
      /* keep raw */
    }
  }

  // Translate the most common Postgres/RLS jargon into plain English.
  if (/row-level security/i.test(raw)) {
    return "You don't have permission to save this to the current organisation. Ask an admin to check your access, then try again.";
  }
  if (/duplicate key|already exists/i.test(raw)) return "That record already exists.";
  if (/permission denied/i.test(raw)) return "Permission denied for this action.";
  if (/JWT|not authenticated|Unauthorized/i.test(raw)) {
    return "Your session expired. Please sign in again.";
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}
