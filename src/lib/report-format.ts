import type { SnagReportT } from "@/lib/snags.functions";

export function snagReportToMarkdown(r: SnagReportT): string {
  const lines: string[] = [];
  lines.push(`# ${r.defectTitle}`);
  lines.push("");
  lines.push(`**Trade:** ${r.trade || "General"}  |  **Severity:** ${r.severity}`);
  lines.push("");
  lines.push("## Description");
  lines.push(r.description || "—");
  lines.push("");
  lines.push("## Root Cause");
  lines.push(r.cause || "—");
  lines.push("");
  lines.push("## Rectification A — Proper");
  lines.push(r.rectificationOptionA || "—");
  lines.push("");
  lines.push("## Rectification B — Alternative");
  lines.push(r.rectificationOptionB || "—");
  if (r.tradesmanHack) {
    lines.push("");
    lines.push("## Tradesman's Hack");
    lines.push(r.tradesmanHack);
  }
  if (r.regulatoryCitations?.length) {
    lines.push("");
    lines.push("## Regulatory Citations");
    for (const c of r.regulatoryCitations) lines.push(`- ${c}`);
  }
  if (r.hsNotes) {
    lines.push("");
    lines.push("## Health & Safety");
    lines.push(r.hsNotes);
  }
  return lines.join("\n");
}
