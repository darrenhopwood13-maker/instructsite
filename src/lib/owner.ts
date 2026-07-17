export const OWNER_EMAIL = "darrenhopwood13@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isOwnerFromClaims(claims: any): boolean {
  return isOwnerEmail(claims?.email ?? claims?.user_metadata?.email ?? null);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
