/** Human-readable labels for app/org role enums. Shared so every surface agrees. */
export function roleLabel(role: string): string {
  switch (role) {
    case "master_admin":
      return "Master Admin";
    case "project_admin":
      return "Project Admin";
    case "site_manager":
      return "Site Manager";
    case "subcontractor":
      return "Subcontractor";
    case "apprentice":
      return "Apprentice";
    case "qs":
      return "QS";
    case "admin":
      return "Project Admin";
    case "pm":
      return "Project Manager / Org Admin";
    default:
      return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
