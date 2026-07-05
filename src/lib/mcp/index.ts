import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getPortfolioSummary from "./tools/get-portfolio-summary";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "instructsite-mcp",
  title: "InstructSite MCP",
  version: "0.1.0",
  instructions:
    "Tools for the InstructSite construction operations platform. Use `list_projects` to enumerate the signed-in user's visible projects, and `get_portfolio_summary` for a cross-project admin snapshot of active crews, manpower and overtime.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, getPortfolioSummary],
});
