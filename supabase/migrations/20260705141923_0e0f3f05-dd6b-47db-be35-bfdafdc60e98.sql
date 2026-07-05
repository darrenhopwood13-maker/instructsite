-- Cumulative approved completion per zone, capped at 100
CREATE OR REPLACE FUNCTION public.zone_approved_completion(_project_id uuid)
RETURNS TABLE (zone_id uuid, total_pct numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT zone_id,
         LEAST(100, COALESCE(SUM(completion_pct), 0))::numeric AS total_pct
  FROM public.daily_site_diaries
  WHERE project_id = _project_id
    AND qs_status = 'approved'
    AND zone_id IS NOT NULL
  GROUP BY zone_id
$$;

GRANT EXECUTE ON FUNCTION public.zone_approved_completion(uuid) TO authenticated, service_role;

-- Auto-flip ifc_synced when cumulative approved completion reaches 100 for a zone
CREATE OR REPLACE FUNCTION public.sync_zone_ifc_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.zone_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(completion_pct), 0)
    INTO v_total
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
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_zone_ifc ON public.daily_site_diaries;
CREATE TRIGGER trg_sync_zone_ifc
AFTER INSERT OR UPDATE OF qs_status, completion_pct
ON public.daily_site_diaries
FOR EACH ROW
EXECUTE FUNCTION public.sync_zone_ifc_on_approval();