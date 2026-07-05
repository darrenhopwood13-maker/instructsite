# Sprint: P0 security hardening + progress math + docs

Consolidated build plan. Ships in one go.

---

## 1 · P0 Security fixes (server-only edits)

### 1a · Kill dev master-admin auto-promotion

**File:** `src/lib/projects.functions.ts` — `getMyRoles` (lines 16-33).

Delete the fallback that inserts `master_admin` when a user has no roles. Replace with a plain read.

**Bootstrap rule:** the very first user in `auth.users` (chronologically) becomes `master_admin` once, via DB trigger. All subsequent users get **no role** until an admin grants one. Migration:

```sql
CREATE OR REPLACE FUNCTION public.bootstrap_first_master_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.bootstrap_first_master_admin();
```

(The `bootstrap_first_master_admin` function already exists per db-functions listing — I'll add the trigger on `auth.users` if it's missing and no-op if present.)

### 1b · Server-side role check on QS approval

**File:** `src/lib/daily-diary.functions.ts` — `setDiaryQsStatus` (lines 85-116).

At the top of the handler, add:

```ts
const { data: allowed } = await context.supabase.rpc("has_role", {
  _user_id: context.userId, _role: "master_admin",
});
const { data: pAdmin } = await context.supabase.rpc("has_role", {
  _user_id: context.userId, _role: "project_admin",
});
const { data: sMgr } = await context.supabase.rpc("has_role", {
  _user_id: context.userId, _role: "site_manager",
});
if (!allowed && !pAdmin && !sMgr) {
  throw new Error("Forbidden: QS approval requires site_manager, project_admin, or master_admin");
}
```

Client toast on failure already surfaces the message.

### 1c · Kill project self-enrolment

**File:** `src/lib/projects.functions.ts` — `getProject` (lines 80-115).

Delete the `supabaseAdmin`-backed auto-insert-as-subcontractor block. If the project row doesn't come back through the authenticated `context.supabase` (RLS-gated), throw `Error("Access denied — you are not a member of this project")`.

**File:** `src/routes/projects.$projectId.tsx` — wrap the `useQuery` error state with an "Access denied" screen (title + short body + link back to `/projects`). Same for `dabs.$projectId.tsx` and `site-manager.$projectId.tsx`.

---

## 2 · Progress math — cumulative approved completion

### 2a · New RPC to aggregate approved completion per zone

Migration adds a SECURITY DEFINER function callable from server functions:

```sql
CREATE OR REPLACE FUNCTION public.zone_approved_completion(_project_id uuid)
RETURNS TABLE (zone_id uuid, total_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT zone_id, LEAST(100, COALESCE(SUM(completion_pct), 0))::numeric AS total_pct
  FROM public.daily_site_diaries
  WHERE project_id = _project_id
    AND qs_status = 'approved'
    AND zone_id IS NOT NULL
  GROUP BY zone_id
$$;

GRANT EXECUTE ON FUNCTION public.zone_approved_completion(uuid) TO authenticated, service_role;
```

Cap at 100 so a zone with over-approved diaries still reports `100`, not `140`.

### 2b · Auto-flip `ifc_synced` when cumulative reaches 100

Migration adds a trigger on `daily_site_diaries`:

```sql
CREATE OR REPLACE FUNCTION public.sync_zone_ifc_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.zone_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(completion_pct), 0) INTO v_total
  FROM public.daily_site_diaries
  WHERE project_id = NEW.project_id
    AND zone_id = NEW.zone_id
    AND qs_status = 'approved';

  IF v_total >= 100 THEN
    UPDATE public.daily_site_diaries
    SET ifc_synced = true
    WHERE project_id = NEW.project_id
      AND zone_id = NEW.zone_id
      AND qs_status = 'approved'
      AND ifc_synced = false;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_zone_ifc ON public.daily_site_diaries;
CREATE TRIGGER trg_sync_zone_ifc
AFTER INSERT OR UPDATE OF qs_status, completion_pct ON public.daily_site_diaries
FOR EACH ROW EXECUTE FUNCTION public.sync_zone_ifc_on_approval();
```

This means: every time a diary is approved OR its `completion_pct` changes, the trigger re-tallies the zone. Once cumulative ≥ 100, **all approved diaries for that zone flip `ifc_synced=true`** so the 3D mesh goes green regardless of which specific diary the viewer keys off.

### 2c · Update `listZoneRuntimeState` to use cumulative completion

**File:** `src/lib/ifc-models.functions.ts` — `listZoneRuntimeState` (lines 126-164).

Change the `complete` calculation from "any diary with ifc_synced=true" to "cumulative approved ≥ 100 via `zone_approved_completion` RPC". Return shape gains `progress_pct` per zone so the UI can show a progress bar. Order of colour precedence stays: `complete > live > unstarted`.

### 2d · Show progress bar in BIM viewer legend

**File:** `src/components/project/BimModelViewer.tsx` — legend chip block. Add a small `{zoneName}: {progress_pct}%` list under the legend so QS/PM see live cumulative progress per zone at a glance. No new components.

---

## 3 · Documentation (three new files in `docs/`)

Ship exactly the content from the previous plan:

- `docs/APP_WORKFLOW.md` — Part 1 walkthrough, one section per workflow (auth → project → drawings → Oracle → zones → DABS → site manager → diary → QS → IFC → HUD). Plain English, no jargon, with a "what to check in the DB" note per section.
- `docs/QA_TEST_SCRIPT.md` — 11 tests as a printable checklist with expected results and DB verification queries.
- `docs/IMPROVEMENT_ROADMAP.md` — P0/P1/P2/P3 list. Mark P0 items 1a/1b/1c and progress math as **DONE in this sprint**; the rest stay as future work.

---

## 4 · Files touched

**New**
- `supabase/migrations/<ts>_p0_security_and_progress_math.sql` — bootstrap trigger (if missing), `zone_approved_completion` RPC, `sync_zone_ifc_on_approval` trigger.
- `docs/APP_WORKFLOW.md`
- `docs/QA_TEST_SCRIPT.md`
- `docs/IMPROVEMENT_ROADMAP.md`

**Edited**
- `src/lib/projects.functions.ts` — remove auto-promote fallback, remove self-enrol block.
- `src/lib/daily-diary.functions.ts` — role check in `setDiaryQsStatus`.
- `src/lib/ifc-models.functions.ts` — cumulative-completion logic in `listZoneRuntimeState`, return `progress_pct`.
- `src/components/project/BimModelViewer.tsx` — show per-zone progress in legend.
- `src/routes/projects.$projectId.tsx`, `src/routes/dabs.$projectId.tsx`, `src/routes/site-manager.$projectId.tsx` — friendly "Access denied" state when `getProject` throws.

**Not touched**
- No changes to `activities` / `permits` / `high_risk_flags` — that's P1 in a later sprint, per your instruction to stay focused on P0 + progress math.
- No changes to Oracle scoping — P1.
- No auth UI added (login page, sign-out). The app still runs anonymously; once you invite real users we'll wire in the login flow. Flag me if you want that in this sprint too.

---

## 5 · What you'll test after this ships

1. As a fresh user (second user in the DB), you should have **no roles** and see "New Project" hidden. Only the first-ever user is master admin.
2. Try approving a diary while signed in as a subcontractor → toast: "Forbidden: QS approval requires…".
3. Try visiting `/projects/<some-other-project-id>` while not a member → "Access denied" screen, no auto-enrol.
4. Submit two diaries for the same zone: 60% approved, then 50% approved. After the second approval, the zone's mesh flips to solid green (cumulative = 100, capped) and both diaries have `ifc_synced=true`.
5. Repeat with 40% + 30% approved — mesh stays orange/grey; legend shows 70%.

Approve and I'll ship the migration first (needs your DB approval), then all code + doc edits in one batch.
