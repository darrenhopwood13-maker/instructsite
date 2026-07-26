-- =========================================================
-- WORKFACE-SCOPED PROGRESS (fixes the double-counting bug)
--
-- Today, zone_approved_completion() sums completion_pct across every
-- approved diary in a work_zone, regardless of which package/trade it
-- came from. Two unrelated packages sharing a zone (e.g. Drylining and
-- Electrical both in "Level 03 East") would have their unrelated
-- percentages added together — a zone could be pushed to "complete" by
-- one trade's work alone while another trade in the same zone had done
-- nothing.
--
-- This migration:
--   1. Adds workface_id to live_site_activity (the DABS pin) and
--      daily_site_diaries (the checkout record), nullable for backward
--      compatibility with existing rows and because the DABS pin-drop UI
--      does not yet let a subcontractor pick a workface (that UI change
--      is a separate, deliberately scoped follow-up — this migration
--      only wires the data model and the calculation).
--   2. Adds workface_approved_completion() — the correct, package-scoped
--      replacement for zone_approved_completion().
--   3. Adds zone_runtime_state() — aggregates workface progress up to a
--      zone for the 3D viewer, which colours per zone (a physical BIM
--      concept), not per package. A zone is only "complete" when every
--      one of its workfaces is complete, not just one trade finishing
--      early. This replaces the ad-hoc aggregation that previously lived
--      in listZoneRuntimeState (src/lib/ifc-models.functions.ts).
--   4. Repoints the sync_zone_ifc_on_approval trigger onto workface_id,
--      with a fallback to the old zone_id-only behaviour ONLY for diaries
--      that have no workface_id set (legacy rows, or any pin dropped
--      before the DABS UI is updated to collect one). This is a bridge,
--      not a permanent design — once every pin flows through a
--      workface, the fallback branch stops being reachable.
--
-- NOTE FOR WHOEVER PICKS THIS UP NEXT: the app also calls a DB function
-- manager_force_checkout(uuid, integer, text) (see
-- src/lib/live-activity.functions.ts) which creates a daily_site_diaries
-- row the same way a normal subcontractor checkout does. Its definition
-- is NOT present anywhere in supabase/migrations — only a later
-- migration that locks down its execute permissions. It must have been
-- created directly against the live database outside of version control.
-- This migration deliberately does NOT touch it, because editing a
-- function whose real current definition is unknown risks silently
-- breaking production force-checkout. Whoever has dashboard access
-- should pull its live definition into a migration file, after which it
-- can be updated to also copy workface_id, matching submitDailyDiary
-- below.
-- =========================================================

ALTER TABLE public.live_site_activity
  ADD COLUMN workface_id uuid REFERENCES public.workfaces(id) ON DELETE SET NULL;
CREATE INDEX idx_live_activity_workface ON public.live_site_activity(workface_id);

ALTER TABLE public.daily_site_diaries
  ADD COLUMN workface_id uuid REFERENCES public.workfaces(id) ON DELETE SET NULL;
CREATE INDEX idx_diaries_workface ON public.daily_site_diaries(workface_id);

-- Cumulative approved completion per workface, capped at 100. This is the
-- package-scoped replacement for zone_approved_completion() — two
-- packages never share a workface, so their progress can no longer mix.
CREATE OR REPLACE FUNCTION public.workface_approved_completion(_project_id uuid)
RETURNS TABLE (workface_id uuid, total_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT workface_id,
         LEAST(100, COALESCE(SUM(completion_pct), 0))::numeric AS total_pct
  FROM public.daily_site_diaries
  WHERE project_id = _project_id
    AND qs_status = 'approved'
    AND workface_id IS NOT NULL
  GROUP BY workface_id
$$;

GRANT EXECUTE ON FUNCTION public.workface_approved_completion(uuid) TO authenticated, service_role;

-- Zone-level view for the 3D viewer: rolls up each zone's workfaces.
-- A zone is "complete" only once EVERY workface tied to it is complete —
-- not just the first trade to finish. progress_pct shown is the average
-- across the zone's workfaces, weighted equally. Zones with no workfaces
-- yet fall back to the legacy zone_approved_completion() figure so
-- projects that haven't adopted workfaces don't lose their progress
-- display outright.
CREATE OR REPLACE FUNCTION public.zone_runtime_progress(_project_id uuid)
RETURNS TABLE (zone_id uuid, progress_pct numeric, all_workfaces_complete boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH workface_progress AS (
    SELECT w.zone_id, w.id AS workface_id,
           COALESCE(wc.total_pct, 0) AS pct
    FROM public.workfaces w
    LEFT JOIN public.workface_approved_completion(_project_id) wc ON wc.workface_id = w.id
    WHERE w.project_id = _project_id
      AND w.status <> 'archived'
      AND w.zone_id IS NOT NULL
  ),
  zone_from_workfaces AS (
    SELECT zone_id,
           AVG(pct)::numeric AS progress_pct,
           BOOL_AND(pct >= 100) AS all_workfaces_complete
    FROM workface_progress
    GROUP BY zone_id
  ),
  legacy AS (
    -- Fallback for zones with no workfaces registered yet.
    SELECT z.id AS zone_id, COALESCE(zc.total_pct, 0) AS progress_pct, COALESCE(zc.total_pct, 0) >= 100 AS all_workfaces_complete
    FROM public.work_zones z
    LEFT JOIN public.zone_approved_completion(_project_id) zc ON zc.zone_id = z.id
    WHERE z.project_id = _project_id
      AND NOT EXISTS (SELECT 1 FROM workface_progress wp WHERE wp.zone_id = z.id)
  )
  SELECT * FROM zone_from_workfaces
  UNION ALL
  SELECT * FROM legacy
$$;

GRANT EXECUTE ON FUNCTION public.zone_runtime_progress(uuid) TO authenticated, service_role;

-- Repoint the ifc_synced trigger onto workface_id, falling back to the
-- old zone_id-only tally only when a diary has no workface_id (legacy
-- rows / pins dropped before the DABS UI collects a workface).
CREATE OR REPLACE FUNCTION public.sync_zone_ifc_on_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.workface_id IS NOT NULL THEN
    SELECT COALESCE(SUM(completion_pct), 0)
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

  -- Legacy fallback: no workface on this diary — behave exactly as before.
  IF NEW.zone_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(completion_pct), 0)
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
AFTER INSERT OR UPDATE OF qs_status, completion_pct, workface_id
ON public.daily_site_diaries
FOR EACH ROW
EXECUTE FUNCTION public.sync_zone_ifc_on_approval();
