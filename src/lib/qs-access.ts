/** Shared helper for Quantity Surveyor role checks. */
export function isQuantitySurveyor(roles: string[]): boolean {
  return roles.includes("qs");
}
