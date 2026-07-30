/** localStorage key holding the most recently visited project id. */
export const LAST_PROJECT_KEY = "is:last-project-id";

export function rememberProject(projectId: string) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
