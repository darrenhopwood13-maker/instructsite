Most of this work is already in place — the full Oracle persona is live in `src/lib/snags.functions.ts` (`analyzeSnag`), the `oracleScan` server function exists in `src/lib/oracle.functions.ts` with the correct Zod schema (no `.default()` calls) and `Output` / `NoObjectGeneratedError` imports, and the "Site Scan" tile with camera/upload flow and `ReportViewer` rendering is already wired into `src/pages/Oracle.tsx`.

The only gap versus your spec is the fellowship list: the current prompts list 6 bodies (FCIOB, FRICS, FICE, FRIBA, FIStructE, FBIID). Your spec adds two more — **FENSA** and **NEIC** — and says the Oracle must cite the relevant body inline.

## Changes

1. `**src/lib/snags.functions.ts**` — in the `systemPrompt` inside `analyzeSnag`, extend the "Fellowships" block to include:
  - `FENSA — Fenestration Self-Assessment Scheme (windows, doors, glazing — Building Regs Part L/F/Q compliance)`
  - `NICEIC — National Inspection Council for Electrical Installation Contracting (Part P, BS 7671)`
   (Assuming "NEIC" in the brief is NICEIC — the standard UK electrical body. Flag if you actually meant something else.) Update the inline-citation guidance sentence to mention FENSA (glazing/fenestration) and NICEIC (electrical) alongside the existing bodies.
2. `**src/lib/oracle.functions.ts**` — same two additions to the `system` prompt inside `oracleScan`, and extend rule 4 to include FENSA and NICEIC in the "cite the relevant fellowship body inline" list.

No schema, UI, or wiring changes — the Zod schemas are already defaults-free and the Oracle page already renders the scan result.

## Question before I build

"NEIC" isn't a standard UK body — did you mean **NICEIC** (electrical contracting)? I'll use NICEIC unless you say otherwise. i mean **NICEIC** (electrical contracting