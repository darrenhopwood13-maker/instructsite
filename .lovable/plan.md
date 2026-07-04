## Phase 4 · End-of-Shift Checkout & Daily Diary Archive

### 1. Data model (one migration)

New table `public.daily_site_diaries` — the permanent legal record:

- `id`, `project_id → projects` (cascade), `live_activity_id → live_site_activity` (nullable, set null)
- `subcontractor_id`, `drawing_id`, `zone_id`, `trade_package`
- `operative_count`, `start_time`, `scheduled_finish`, `checkout_time` (default now)
- `hours_logged` numeric (computed at insert from start/checkout)
- `progress_status` text check `('completed','partial','not_completed')`
- `completion_pct` int 0–100
- `notes` text (delays / variances)
- `photo_urls` text[] (storage keys)
- `qs_status` text check `('pending','approved','rejected')` default `'pending'` — feeds the QS queue
- `ifc_synced` bool default false — flipped when 100% and approved
- `created_at`, `updated_at`

Grants + RLS: authenticated members can insert-own and select project rows; project admins can update `qs_status`/`ifc_synced`; service_role all.

Extend `live_site_activity_status_check` to allow `'archived'` (existing `'closed'` stays for manual clear-outs).

Storage bucket `diary-photos` (private) with policies: authenticated project members upload/read their project's paths, path prefix `{project_id}/{diary_id}/…`.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_site_diaries;` (live_site_activity already in publication via existing site-manager subscription).

### 2. Server functions (`src/lib/daily-diary.functions.ts`)

- `submitDailyDiary` (POST, auth) — validates input, flips the matching `live_site_activity` row to `status='archived'`, computes `hours_logged`, inserts `daily_site_diaries` row, returns it. All in one call; RLS scopes to caller.
- `listQsQueue` (GET, auth) — project-admin only; returns `qs_status='pending'` rows joined with zone/drawing names.
- `approveDiary` (POST, auth) — project-admin only; sets `qs_status='approved'`; when `completion_pct=100` also sets `ifc_synced=true` (the IFC viewer reads this flag).
- `rejectDiary` (POST, auth) — mirror.

### 3. Subcontractor checkout UI (`src/routes/dabs.$projectId.tsx`)

Replace the small "Clear Out" link per active pin with a prominent full-width button on each pin card: **"Close Out Today's Shift / Complete Daily Diary"** (high-contrast orange). Existing pin-drop / briefing flow untouched.

New modal component `src/components/project/CheckoutDiaryModal.tsx` opened from that button. Fields:

- Task Progress Status — segmented radio: Completed / Partial / Not Completed
- Estimated Zone Completion % — shadcn `Slider` 0–100 + numeric input, kept in sync
- Photo Evidence — dropzone (reuse `DropZone` pattern) that also renders `<input type="file" accept="image/*" capture="environment" multiple>` so mobile opens the camera; uploads to `diary-photos` bucket via `supabase.storage`, collects returned paths
- Notes / Delays — `Textarea` (max 2000 chars)
- Submit → calls `submitDailyDiary`, toasts success, invalidates `live-pins` query (pin disappears from own list) and closes modal

### 4. Realtime HUD cleanup (Site Manager)

`site-manager.$projectId.tsx` already subscribes to `live_site_activity` `postgres_changes` and requeries. Because `submitDailyDiary` transitions `status → 'archived'` and the list filters `activeOnly` (`status='active'`), the pin drops off in real time — no client changes needed there. Add a small "Archived today: N" line under the stat cards fed by a lightweight `daily_site_diaries` count query for the current day.

### 5. Commercial matrix hooks

Both live in the Site Manager (project-admin surface):

- **QS Verification Queue** — new collapsible section listing `listQsQueue` output with Approve / Reject buttons. On approve at 100 %, backend sets `ifc_synced=true`.
- **IFC Model color update** — the IFC 3D viewer doesn't exist yet; scaffold a `src/components/project/IfcMeshStatus.tsx` panel that reads approved diaries with `completion_pct=100` grouped by `zone_id` and renders each zone as a chip: orange = in progress, solid green = complete. When the real IFC viewer lands, it consumes the same query. Both design tokens (`--alert` orange and a new `--complete` green) added to `src/styles.css`.

### 6. Files touched

New:
- `supabase/migrations/<ts>_daily_diaries.sql`
- `src/lib/daily-diary.functions.ts`
- `src/components/project/CheckoutDiaryModal.tsx`
- `src/components/project/IfcMeshStatus.tsx`
- `src/components/project/QsVerificationQueue.tsx`

Edited:
- `src/routes/dabs.$projectId.tsx` — big checkout button per pin, mount modal
- `src/routes/site-manager.$projectId.tsx` — archived-today stat, mount QS queue + IFC status
- `src/styles.css` — `--complete` green token
- `src/integrations/supabase/types.ts` — regenerated after migration approves

### 7. Explicit non-goals (call out, not build)

- No real IFC 3D geometry viewer — only the status chip panel that will feed one later.
- No QS-user role separation beyond project-admin; the QS queue is admin-scoped for now.
- No PDF export of the diary — data lives structured in `daily_site_diaries` ready for later report generation.

Approve to proceed and I'll ship the migration first, then wire the UI.