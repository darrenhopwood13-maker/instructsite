
ALTER TABLE public.daily_site_diaries
  ADD COLUMN IF NOT EXISTS manager_force_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_closed_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.manager_force_checkout(
  _pin_id uuid,
  _completion_pct integer,
  _notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pin public.live_site_activity;
  v_diary_id uuid;
  v_hours numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_pin FROM public.live_site_activity WHERE id = _pin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pin not found';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
    OR public.is_project_admin(v_pin.project_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager role required';
  END IF;

  IF v_pin.status <> 'active' THEN
    RAISE EXCEPTION 'Pin already closed';
  END IF;

  v_hours := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_pin.start_time)) / 3600.0);

  INSERT INTO public.daily_site_diaries (
    project_id, live_activity_id, subcontractor_id, drawing_id, zone_id,
    trade_package, operative_count, start_time, scheduled_finish, checkout_time,
    hours_logged, progress_status, completion_pct, notes, photo_urls,
    manager_force_closed, force_closed_by
  ) VALUES (
    v_pin.project_id, v_pin.id, v_pin.subcontractor_id, v_pin.drawing_id, v_pin.zone_id,
    v_pin.trade_package, v_pin.operative_count, v_pin.start_time, v_pin.scheduled_finish, now(),
    round(v_hours::numeric, 2),
    CASE WHEN _completion_pct >= 100 THEN 'completed'
         WHEN _completion_pct > 0 THEN 'partial'
         ELSE 'not_completed' END,
    LEAST(100, GREATEST(0, _completion_pct)),
    COALESCE(NULLIF(_notes, ''), 'Automated manager checkout — crew left site.'),
    ARRAY[]::text[],
    true,
    v_uid
  )
  RETURNING id INTO v_diary_id;

  UPDATE public.live_site_activity
     SET status = 'archived'
   WHERE id = v_pin.id;

  RETURN v_diary_id;
END;
$$;
