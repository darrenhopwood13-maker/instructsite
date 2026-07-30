/** Shared, client-safe formatting for invite rows. */

export function formatSentDate(iso?: string | null): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function daysAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export type ExpiryInfo = { label: string; expired: boolean; urgent: boolean };

export function expiryCountdown(iso?: string | null): ExpiryInfo {
  if (!iso) return { label: "No expiry", expired: false, urgent: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return { label: "No expiry", expired: false, urgent: false };
  if (ms <= 0) return { label: "Expired", expired: true, urgent: true };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) {
    return { label: `Expires in ${hours || 1}h`, expired: false, urgent: true };
  }
  const days = Math.floor(hours / 24);
  return { label: `Expires in ${days}d`, expired: false, urgent: days <= 3 };
}
