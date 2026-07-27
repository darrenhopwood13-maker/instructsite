# Diagnostic Report — 4 Blocking Bugs

Read-only investigation. No code changed. Findings + minimal safe fixes below.

---

## Bug 1 — Snag Master upload returns "Bad Request"

**File:** `src/lib/snags.functions.ts`
**Function:** `analyzeSnag` (lines 103–202)
**Callsite:** `src/routes/snags.new.tsx` → `handleFile` (line ~54, `analyzeFn({ data: { fileName, mimeType, dataBase64 } })`).

**What happens on the wire**
The framed response `{"message":{"t":1,"s":"Bad Request"}}` is TanStack's serialized `Error("Bad Request")` returned with HTTP 200 (that's how server-fn errors are transported). So `analyzeSnag`'s handler is throwing an `Error` whose message is literally `Bad Request`. The Zod validator would throw a `ZodError`, not `Bad Request`. The storage bucket exists (`snag-photos`) and its RLS is fine (org-folder scoped, matches `${orgId}/…` upload path). So the throw is coming from the AI call.

**Root cause**
`generateText({ model: gateway("openai/gpt-4o"), output: Output.object({ schema: SnagReport }), messages: [image+text] })` is being sent to the Lovable AI Gateway. The gateway routinely rejects the `openai/gpt-4o` route + `Output.object` (structured-output) combination — same failure class we hit on the Oracle Vision path. The gateway responds `400 Bad Request`, the AI SDK rethrows it, and the catch at line 199 rewrites it as `new Error("Bad Request")` (because `(error as any).message` is exactly that string). The photo does upload first (line 133) and is then cleaned up (line 197), which is why nothing is left in the bucket.

**Secondary issue (project scoping)**
`/snags` is org-scoped, not project-scoped. Schema check: `public.snags` has `org_id` + `snag_project_id` (nullable) but no `project_id`, and `snags.new.tsx` never sets `snag_project_id`. That's why a snag can't be attached to a project.

**Minimal safe fix**
1. Switch `analyzeSnag` to the same working shape used by the Oracle stream: `google/gemini-2.5-pro` (or `google/gemini-2.5-flash` for speed), and drop `Output.object`. Instead, ask for a strict JSON reply in the system prompt and `JSON.parse` on return (fallback: retry once, then throw a real message). Keep `SnagReport` as a validator on the parsed object.
2. Propagate the *real* gateway error text in the catch (line 195–201) — include status + body — instead of collapsing to `Bad Request`.
3. Add a project selector to `/snags/new`: default to the current active project (from `UserContextChip` / last visited project), pass `projectId` into `createSnag`, and write it to `snags.snag_project_id`. Filter `/snags` list by the active project.

---

## Bug 2 — Oracle output invisible on `/tooling` (white-on-white)

**Files:**
- `src/components/tooling/ToolingTerminal.tsx` (light panel: `bg-sky-50`, `border-sky-200`, inner card `bg-white/60`)
- `src/components/tooling/OracleMarkdown.tsx` (all text uses theme tokens: `text-foreground`, `text-muted-foreground`, `bg-white/10`)
- `src/components/tooling/ToolingResults.tsx` (renders `<OracleMarkdown>` inside the light card)

**Root cause**
`ToolingTerminal` was re-skinned light (sky-50 + white cards) but the markdown renderer still emits `text-foreground`. The app root is dark, so `--foreground` resolves to `oklch(0.98 0 0)` (near-white). White text on the `bg-sky-50` / `bg-white/60` card ⇒ ~1.05:1 contrast. Same problem for `text-muted-foreground` (near-white with alpha) and the inline `<code>` badge `bg-white/10 text-primary`.

**Minimal safe fix**
Two clean options:
- **A. Make the terminal dark again** (matches the rest of the app): revert `ToolingTerminal` panel/header/footer to the dark glass tokens (`bg-background/60`, `border-white/10`, header `bg-black/40`). Zero changes to `OracleMarkdown`. Recommended — it matches ReportViewer and the rest of the shell.
- **B. Keep the light panel** and give `OracleMarkdown` an explicit `text-slate-900` scope wrapper (`<div class="prose-oracle text-slate-900 [&_strong]:text-slate-900 [&_code]:bg-slate-900/5 [&_code]:text-primary [&_em]:text-slate-700 [&_a]:text-primary">…`). Also swap the progress `ol` in `ToolingTerminal` (`border-white/10 bg-white/[0.02]`, `text-muted-foreground`) to slate equivalents.

Pick A unless the light look is intentional.

---

## Bug 3 — "Ask The Oracle" silently fails, panel resets to READY

**Files:**
- `src/routes/api/oracle-stream.ts` (server route)
- `src/routes/tooling.tsx` (client SSE reader, lines 91–144)

**Function paths:** `PROMPTS.ai_assist` (line 73) and the `ActionGrid` key `ai_assist` (`src/components/tooling/ActionGrid.tsx:33`).

**Root cause**
The reader treats a stream that *closes with zero content deltas* as a successful run — it just sets `isStreaming=false` in `finally` and the terminal's effect resets `stepIdx` back to 0 ("READY"). Two things collude to produce that on `ai_assist`:

1. `ai_assist`'s user text falls through to the generic `"Provide your standard analysis per the task brief above."` when the user hasn't typed a question and hasn't attached anything. `google/gemini-2.5-pro` frequently returns a safety/empty completion for that vague instruction (or an OpenAI-style event with `finish_reason` but no `delta.content`). Safety Auditor works because its prompt is far more directive.
2. There is no "no content produced" guard in `tooling.tsx`: after `while (!streamDone)` ends, if `assistantSoFar === ""` nothing is shown and no toast is fired. Same in the trailing buffer block (128–144).

Also, the upstream `fetch` at `oracle-stream.ts:159` has no timeout / abort — if Gemini stalls for the full window and closes with no chunks, we still hit "no chunks, no error".

**Minimal safe fix**
1. In `tooling.tsx`, after the reader loop finishes: if `assistantSoFar.trim() === ""`, `toast.error("The Oracle returned nothing — try adding a photo/PDF or a specific question.")` and keep `activeFunction` set (don't reset).
2. In `oracle-stream.ts`, when parsing SSE, capture `choices[0].finish_reason` / `choices[0].delta.refusal` and, if the run ends with `content_filter`, `length`, or an empty `stop`, forward a final SSE event like `data: {"choices":[{"delta":{"content":"⚠ Oracle returned no content (finish_reason=…). Try again with an attachment or a sharper question."}}]}` before closing. Simplest: pipe through a `TransformStream` that watches for empty completion and emits that fallback line.
3. Tighten the `ai_assist` prompt: require a minimum output (headline + `## Site Call`) so Gemini can't legitimately return empty; and if `userQuestion` is empty and no attachment is present, short-circuit at the route with `400 { error: "Add a question, drawing or photo before asking The Oracle." }` — matches the `snag_master` guard already in `tooling.tsx:45`.

---

## Bug 4 — Subcontractor Weekly Pack Master View shows "No subcontractors registered"

**Files:**
- `src/routes/subcontractor-pack.$projectId.manager.tsx` (page, lines 38–46 call `getManagerPack`)
- `src/lib/subcontractor-pack.functions.ts` → **`getManagerPack`** (lines 208–237)

**Root cause (confirmed with a DB read)**
`getManagerPack` selects from `public.subcontractors` filtered by `project_id`. For "Willow Bank House — New Build Detached Dwelling" (`87b2d7c6-…`):
- `subcontractors` rows for that project = **0**
- `subcontractor_invites` rows for that project = **7**

The 7 subs the user sees on the project page are `subcontractor_invites` (PENDING). A `subcontractors` row is only ever created lazily by `ensureSubcontractor` (line 22) the first time the sub opens their own pack portal. Until then the manager view has nothing to show, and consequently PUWER/LOLER/toolbox records (which FK to `subcontractors.id`) can never appear either.

There is no status filter and no join to `org_members` — the query is just empty because the rows don't exist.

**Minimal safe fix**
Change `getManagerPack` to union the two sources so the master view mirrors what the project page shows:
1. Select all `subcontractor_invites` for the project that are not revoked, keyed by `lower(company_name)`.
2. Left-join to `subcontractors` on `(project_id, lower(company_name))` to attach a real `subcontractor_id` when it exists.
3. For rows that have no `subcontractor_id` yet, materialise one on read (call `ensureSubcontractor(project_id, company_name)` — already exists, line 22) so PUWER/LOLER/toolbox records can be recorded against a stable id. Return `status: invite.accepted_at ? 'active' : 'pending'` so the card can badge PENDING vs ACTIVE instead of hiding them.
4. Keep the existing per-sub fan-out (workers/registers/talks/look-aheads) unchanged.

No RLS change needed — `subcontractor_invites` already has a project-member read policy and `subcontractors` policy allows project members + master_admin.

---

## Summary table

| # | File | Function | Root cause | Fix |
|---|------|----------|-----------|-----|
| 1 | `src/lib/snags.functions.ts` | `analyzeSnag` (103) | Lovable Gateway rejects `openai/gpt-4o` + `Output.object`; catch collapses to "Bad Request"; no project scoping | Switch to `google/gemini-2.5-pro` + JSON-parse; surface real error; add project selector, write `snag_project_id` |
| 2 | `src/components/tooling/ToolingTerminal.tsx` + `OracleMarkdown.tsx` | render tree | Light panel + `text-foreground` (near-white in dark theme) | Revert terminal to dark tokens (preferred) or scope OracleMarkdown with slate-900 overrides |
| 3 | `src/routes/api/oracle-stream.ts` + `src/routes/tooling.tsx` | POST handler + SSE reader | Empty completion from Gemini for vague `ai_assist` prompt; client treats zero-chunk stream as success and resets | Guard empty output client-side w/ toast; emit fallback SSE line server-side; require question/attachment for `ai_assist` |
| 4 | `src/lib/subcontractor-pack.functions.ts` | `getManagerPack` (208) | Queries `subcontractors` but project only has `subcontractor_invites`; no materialisation | Union invites + subs, ensure a `subcontractors` row per invite on read, tag `pending`/`active` |

Approve to proceed and I'll implement the fixes in this order: **4 → 2 → 3 → 1** (data visibility first, then the two Oracle issues, then the AI-gateway swap for Snag Master).