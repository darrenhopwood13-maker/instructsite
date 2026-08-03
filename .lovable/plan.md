# Short-Term Programmes for mid-project subcontractors

A self-contained mini-programme per subcontractor package, created either by uploading their own
programme or by an AI builder. Two-sided acceptance locks it; after that it is annotation only.
The master baseline (`programme_reference_tasks`) is never read from or written to by this feature.

## Data model (4 new tables + 2 library tables)

`short_term_programmes`
- project_id, subcontractor_id (-> `public.subcontractors.id`, same identity the weekly packs use),
  site_manager_user_id, package_label, status (`draft` | `pending_acceptance` | `accepted`),
  created_via (`upload` | `ai_builder`), created_by,
  site_manager_accepted_at/by, subcontractor_accepted_at/by, site_document_id (set when filed), timestamps.

`short_term_programme_tasks`
- programme_id, seq, task_name, start_date, end_date, predecessors (text[] of local refs),
  status (`not_started` | `in_progress` | `at_risk` | `done`), timestamps.

`short_term_programme_annotations`
- programme_id, task_id (nullable = whole-programme note), author_user_id, note, created_at.
  Append-only, no update/delete — same shape and RLS style as `permit_events`.

`project_activity_descriptions` — project-scoped, full detail allowed. Readable only by members of
that project. This is where every custom entry auto-saves.

`org_activity_types` — org-scoped generic activity types only. Readable by org members. Nothing is
inserted here except through the opt-in promotion path below.

### Server-side rules (triggers + security-definer RPCs, not UI-only)
- **5-programme cap**: `BEFORE INSERT` trigger counting existing rows for (project_id, subcontractor_id).
  Rejects the 6th. UI shows "N of 5 used".
- **Accepted lock**: `BEFORE UPDATE/DELETE` trigger on tasks rejecting any change to name/dates/seq/
  predecessors once the parent is `accepted`; only `status` may change. Same lock pattern as permits.
- **Two-sided acceptance**: `accept_short_term_programme(_id)` RPC decides which side the caller is
  (project admin/site manager vs a user with an accepted subcontractor invite for that company),
  stamps that side, and flips status to `accepted` only when both stamps exist.

## Reused, not rebuilt
- **Import**: `compileProgrammeFile` from `programme-compiler.server.ts`, rows written to
  `short_term_programme_tasks` instead of the baseline table.
- **Progress**: `buildVariance` from `programme-variance.ts`, given only this programme's tasks
  (as a single package) and only this subcontractor's pins/verified diaries for that package,
  plus `writePositionNotes` / `fallbackNote` for the plain-English line.
- **Package picking**: `listProgrammePackages` + `TradePackageField`; falls back to the invite's
  assigned packages when there is no baseline.

## UI
- `src/routes/short-term.$projectId.tsx` — list scoped by role: site manager sees all subcontractors'
  programmes on the project, a subcontractor PM sees only their own company's. Equal create / edit-
  while-draft / send-for-approval / accept / annotate rights for both.
- Detail view: draft editor -> approval banner showing both acceptance stamps -> once accepted, a
  read-only task list with status chips, the mini variance strip, and the annotation thread.
- **AI Builder**: pick subcontractor -> pick package -> add one or more activities from the activity
  picker -> AI proposes named, sequenced tasks with durations -> user tunes dates.
- **Date control**: new `TaskDateBar` — a horizontal scrollable day strip with tap-to-set start/end
  plus ±1 day / ±1 week and duration steppers, sized for thumbs. No native `type="date"` in this flow.
- Entry point in the existing invite/onboarding flow: "Does this subcontractor already have a
  programme for this work?" -> Upload / Build Programme.

## Activity library behaviour
Type-ahead dropdown: this project's saved entries first, org-wide generic types below, "Add custom"
always last. Custom text saves to the project list immediately and never blocks.

Promotion to the org library is **two-stage and opt-in**:
1. A deterministic guard runs first and is the hard gate — any digits, units (mm/m/kg/m2), a
   capitalised brand-looking token, room/grid/level references, or excess length means
   project-specific: no prompt, ever, and no AI call is made with that text.
2. Only text that clears the guard is sent to the AI, which returns a cleaned generic type. The user
   gets a one-tap, skippable prompt. Ignoring it has no consequence.

## Calls I am making (flagging, per your ask)
- **Bible filing: accepted only.** Drafts churn and pending programmes are by definition not agreed;
  filing them would put unagreed dates into the permanent record. An accepted programme is filed once
  as a PDF, and a re-issue (a new programme for the same package) files as its own document.
- **Bible structure**: I will mirror the `subcontractor_pack_issues` pattern exactly — its own branch
  in `listProjectBibleDocuments` with category "Short-Term Programmes" and the title prefixed with the
  company name, which is how subcontractor-specific documents are already grouped there. No new
  organising concept.
- **Generic vs project-specific**: rules first, AI second (above). A pure AI classifier is the wrong
  hard gate for a confidentiality constraint because it can be talked around; a pure rules approach
  can't produce a clean generic label. The rules decide *whether*, the AI only decides *what wording*.

## Needs your input
- **Who counts as "the subcontractor PM"** for the acceptance stamp: any user who accepted an invite
  for that company on the project, or strictly the invite's `package_manager_id` / PM seat? I will
  implement "any accepted user on an admin seat for that company" unless you say otherwise.
- **Cap semantics**: 5 per subcontractor per project counting *all* statuses, including superseded
  accepted ones. I will count all rows; say the word if drafts should be excluded from the cap.
