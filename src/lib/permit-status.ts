/** Shared, client-computable permit lifecycle state (no cron required). */
export type PermitLifecycle = "live" | "expired" | "revoked" | "pending";

export type PermitLike = {
  status: string;
  valid_from?: string | null;
  valid_to: string | null;
};

export function permitLifecycle(p: PermitLike, now: number = Date.now()): PermitLifecycle {
  if (p.status === "revoked") return "revoked";
  if (p.status !== "active") return "expired";
  if (p.valid_to && new Date(p.valid_to).getTime() <= now) return "expired";
  if (p.valid_from && new Date(p.valid_from).getTime() > now) return "pending";
  return "live";
}

export function isPermitLive(p: PermitLike, now?: number) {
  return permitLifecycle(p, now) === "live";
}

export function isPermitExpired(p: PermitLike, now?: number) {
  return permitLifecycle(p, now) === "expired";
}

export const LIFECYCLE_LABEL: Record<PermitLifecycle, string> = {
  live: "Live",
  expired: "Expired",
  revoked: "Revoked",
  pending: "Not yet valid",
};
