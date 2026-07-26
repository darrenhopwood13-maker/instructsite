-- =========================================================
-- MANAGER INSPECTION & SIGN-OFF (Step 5)
--
-- Today, "Approve" on the QS queue is a single click that accepts the
-- subcontractor's self-reported completion_pct as-is — there is no
-- record of a manager actually inspecting the work, no manager-captured
-- evidence, and no distinction between what the subcontractor claimed
-- and what was actually verified on site. This was explicitly called
-- out as the goal from the start: "the site manager never signs off
-- automatically" — the subcontractor's checkout is a claim, not a
-- verified record.
--
-- This migration adds the fields needed for genuine manager inspection:
-- their own assessed completion percentage (which may differ from the
-- subcontractor's claim), their own notes and photo evidence, and who/
-- when they inspected. It also adds an audit trail so an already-
-- approved day can't be silently corrected — any change after approval
-- is captured with who changed it, when, and why.
-- =========================================================

ALTER TABLE public.daily_site_diaries
  ADD COLUMN manager_completion_pct integer CHECK (manager_completion_pct BETWEEN 0 AND 100),
  ADD COLUMN manager_notes text,
  ADD COLUMN manager_photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN inspected_by uuid REFERENCES auth.users(id),
  ADD COLUMN inspected_at timestamptz;

-- Audit trail: one row per change to an already-approved diary's
-- authorised figures. Populated by amend_approved_diary() below, not by
-- direct table writes — RLS on daily_site_diaries still allows project
-- admins to UPDATE (unchanged from before), but the app should route
-- corrections through this function so they're captured. This is a
-- process control, not a database-enforced one: a determined direct SQL
-- edit could still bypass it, same as any other audit trail of this kind.
CREATE TABLE public.diary_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id uuid NOT NULL REFERENCES public.daily_site_diaries(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  previous_manager_completion_pct integer,
  new_manager_completion_pct integer,
  previous_qs_status text,
  new_qs_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.diary_amendments TO authenticated;
GRANT ALL ON public.diary_amendments TO service_role;
ALTER TABLE public.diary_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view amendments" ON public.diary_amendments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_site_diaries d
      WHERE d.id = diary_id AND public.is_project_member(d.project_id, auth.uid())
    )
  );

CREATE POLICY "Admins insert amendments" ON public.diary_amendments
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.daily_site_diaries d
      WHERE d.id = diary_id AND public.is_project_admin(d.project_id, auth.uid())
    )
  );

CREATE INDEX idx_diary_amendments_diary ON public.diary_amendments(diary_id);

-- Manager authorisation: sets the manager's own assessed completion
-- percentage, notes, and photo evidence, and approves in one step.
-- completion_pct itself is left untouched (it stays the subcontractor's
-- original claim, for comparison) — manager_completion_pct is what
-- workface_approved_completion() now reads, via COALESCE, so authorised
-- progress reflects what was actually verified once a manager has
-- inspected, while still falling back sensibly to the subcontractor's
-- figure for any diary a manager hasn't gotten to yet.
CREATE OR REPLACE FUNCTION public.manager_authorise_diary(
  _diary_id uuid,
  _manager_completion_pct integer,
  _manager_notes text DEFAULT NULL,
  _manager_photo_urls text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _manager_completion_pct < 0 OR _manager_completion_pct > 100 THEN
    RAISE EXCEPTION 'manager_completion_pct must be between 0 and 100';
  END IF;

  SELECT project_id INTO v_project_id FROM public.daily_site_diaries WHERE id = _diary_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Diary not found';
  END IF;
  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager authorisation requires site_manager, project_admin, or master_admin role';
  END IF;

  UPDATE public.daily_site_diaries
     SET manager_completion_pct = _manager_completion_pct,
         manager_notes = _manager_notes,
         manager_photo_urls = COALESCE(_manager_photo_urls, '{}'),
         inspected_by = v_uid,
         inspected_at = now(),
         qs_status = 'approved'
   WHERE id = _diary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manager_authorise_diary(uuid, integer, text, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.manager_authorise_diary(uuid, integer, text, text[]) FROM PUBLIC, anon;

-- Amend an already-approved diary. Requires a reason, logs the change,
-- and is the only sanctioned way to correct a manager_completion_pct or
-- qs_status after initial approval.
CREATE OR REPLACE FUNCTION public.amend_approved_diary(
  _diary_id uuid,
  _new_manager_completion_pct integer,
  _reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_diary public.daily_site_diaries;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to amend an approved diary';
  END IF;
  IF _new_manager_completion_pct < 0 OR _new_manager_completion_pct > 100 THEN
    RAISE EXCEPTION 'manager_completion_pct must be between 0 and 100';
  END IF;

  SELECT * INTO v_diary FROM public.daily_site_diaries WHERE id = _diary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Diary not found';
  END IF;
  IF NOT public.is_project_admin(v_diary.project_id, v_uid) THEN
    RAISE EXCEPTION 'Forbidden: amending an approved diary requires project admin or master admin';
  END IF;
  IF v_diary.qs_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved diaries can be amended — use manager_authorise_diary for the initial sign-off';
  END IF;

  INSERT INTO public.diary_amendments (
    diary_id, changed_by, reason,
    previous_manager_completion_pct, new_manager_completion_pct,
    previous_qs_status, new_qs_status
  ) VALUES (
    _diary_id, v_uid, _reason,
    v_diary.manager_completion_pct, _new_manager_completion_pct,
    v_diary.qs_status, 'approved'
  );

  UPDATE public.daily_site_diaries
     SET manager_completion_pct = _new_manager_completion_pct
   WHERE id = _diary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.amend_approved_diary(uuid, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.amend_approved_diary(uuid, integer, text) FROM PUBLIC, anon;

-- Point workface_approved_completion() at the manager-authorised figure
-- once one exists, falling back to the subcontractor's original claim
-- for diaries not yet inspected. This gives the manager authorisation
-- step real teeth: once inspected, the manager's figure is what counts
-- toward progress, not the subcontractor's self-report.
CREATE OR REPLACE FUNCTION public.workface_approved_completion(_project_id uuid)
RETURNS TABLE (workface_id uuid, total_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT workface_id,
         LEAST(100, COALESCE(SUM(COALESCE(manager_completion_pct, completion_pct)), 0))::numeric AS total_pct
  FROM public.daily_site_diaries
  WHERE project_id = _project_id
    AND qs_status = 'approved'
    AND workface_id IS NOT NULL
  GROUP BY workface_id
$$;

-- The ifc_synced trigger (added in the workface-scoped-progress migration)
-- independently re-tallies the same sum rather than calling
-- workface_approved_completion(), so it needs the same COALESCE fix to
-- stay consistent with it.
CREATE OR REPLACE FUNCTION public.sync_zone_ifc_on_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.workface_id IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(manager_completion_pct, completion_pct)), 0)
      INTO v_total
      FROM public.daily_site_diaries
     WHERE project_id = NEW.project_id
       AND workface_id = NEW.workface_id
       AND qs_status = 'approved';

    IF v_total >= 100 THEN
      UPDATE public.daily_site_diaries
         SET ifc_synced = true
       WHERE project_id = NEW.project_id
         AND workface_id = NEW.workface_id
         AND qs_status = 'approved'
         AND ifc_synced = false;
    END IF;
    RETURN NEW;
  END IF;

  -- Legacy fallback: no workface on this diary — behave as before.
  IF NEW.zone_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(COALESCE(manager_completion_pct, completion_pct)), 0)
    INTO v_total
    FROM public.daily_site_diaries
   WHERE project_id = NEW.project_id
     AND zone_id = NEW.zone_id
     AND workface_id IS NULL
     AND qs_status = 'approved';

  IF v_total >= 100 THEN
    UPDATE public.daily_site_diaries
       SET ifc_synced = true
     WHERE project_id = NEW.project_id
       AND zone_id = NEW.zone_id
       AND workface_id IS NULL
       AND qs_status = 'approved'
       AND ifc_synced = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_zone_ifc ON public.daily_site_diaries;
CREATE TRIGGER trg_sync_zone_ifc
AFTER INSERT OR UPDATE OF qs_status, completion_pct, manager_completion_pct, workface_id
ON public.daily_site_diaries
FOR EACH ROW
EXECUTE FUNCTION public.sync_zone_ifc_on_approval();
