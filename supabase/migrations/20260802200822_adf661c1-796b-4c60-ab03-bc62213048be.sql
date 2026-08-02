CREATE TABLE public.permit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid REFERENCES public.permits(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('issued','revoked','expired','renewed')),
  actor_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX permit_events_permit_idx ON public.permit_events(permit_id);
CREATE INDEX permit_events_activity_idx ON public.permit_events(activity_id);
CREATE INDEX permit_events_project_idx ON public.permit_events(project_id, created_at DESC);

GRANT SELECT ON public.permit_events TO authenticated;
GRANT ALL ON public.permit_events TO service_role;

ALTER TABLE public.permit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view permit history"
ON public.permit_events FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- Issue: log an 'issued' event
CREATE OR REPLACE FUNCTION public.issue_activity_permit(_activity_id uuid, _permit_type text, _valid_hours integer DEFAULT 8)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_act public.activities;
  v_permit_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_act FROM public.activities WHERE id = _activity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
    OR public.is_project_admin(v_act.project_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'Forbidden: permit issuance requires site manager or project admin role';
  END IF;

  IF NOT (_permit_type = ANY (public.high_risk_categories())) THEN
    RAISE EXCEPTION 'Unknown permit type: %', _permit_type;
  END IF;

  _valid_hours := LEAST(720, GREATEST(1, COALESCE(_valid_hours, 8)));

  INSERT INTO public.permits (project_id, activity_id, permit_type, issued_by, valid_from, valid_to, status)
  VALUES (v_act.project_id, _activity_id, _permit_type, v_uid, now(), now() + make_interval(hours => _valid_hours), 'active')
  RETURNING id INTO v_permit_id;

  UPDATE public.activities SET permit_status = 'active' WHERE id = _activity_id;
  UPDATE public.live_site_activity SET permit_status = 'active' WHERE activity_id = _activity_id;

  INSERT INTO public.permit_events (permit_id, activity_id, project_id, event_type, actor_id, metadata)
  VALUES (v_permit_id, _activity_id, v_act.project_id, 'issued', v_uid,
          jsonb_build_object('permit_type', _permit_type, 'valid_hours', _valid_hours));

  RETURN v_permit_id;
END;
$function$;

-- Revoke: log a 'revoked' event, stop mutating the description
CREATE OR REPLACE FUNCTION public.revoke_permit(_permit_id uuid, _reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.permits;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_p FROM public.permits WHERE id = _permit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
    OR public.is_project_admin(v_p.project_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'Forbidden: permit revocation requires site manager or project admin role';
  END IF;

  UPDATE public.permits
     SET status = 'revoked', valid_to = LEAST(COALESCE(valid_to, now()), now())
   WHERE id = _permit_id;

  IF v_p.activity_id IS NOT NULL THEN
    UPDATE public.activities SET permit_status = 'required' WHERE id = v_p.activity_id;
    UPDATE public.live_site_activity SET permit_status = 'required' WHERE activity_id = v_p.activity_id;
  END IF;

  INSERT INTO public.permit_events (permit_id, activity_id, project_id, event_type, actor_id, reason)
  VALUES (_permit_id, v_p.activity_id, v_p.project_id, 'revoked', v_uid, NULLIF(btrim(COALESCE(_reason,'')), ''));

  RETURN true;
END;
$function$;

-- Pin permits also log
CREATE OR REPLACE FUNCTION public.issue_pin_permit(_pin_id uuid, _valid_hours integer DEFAULT 8)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pin public.live_site_activity;
  v_activity_id uuid;
  v_permit_id uuid;
  v_permit_type text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_pin FROM public.live_site_activity WHERE id = _pin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pin not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden: permit issuance requires site manager role';
  END IF;

  IF NOT v_pin.permit_required THEN
    RAISE EXCEPTION 'Pin does not require a permit';
  END IF;

  v_permit_type := COALESCE(v_pin.high_risk_flags[1], 'working_at_height');

  IF v_pin.activity_id IS NOT NULL THEN
    v_activity_id := v_pin.activity_id;
  ELSE
    INSERT INTO public.activities (
      project_id, subcontractor_id, drawing_id, zone_id,
      description, high_risk_flags, permit_status
    ) VALUES (
      v_pin.project_id, v_pin.subcontractor_id, v_pin.drawing_id, v_pin.zone_id,
      COALESCE(v_pin.trade_package,'') || ' — ' || COALESCE(v_pin.notes,''),
      v_pin.high_risk_flags, 'active'
    )
    RETURNING id INTO v_activity_id;
  END IF;

  INSERT INTO public.permits (
    project_id, activity_id, permit_type, issued_by, valid_from, valid_to, status
  ) VALUES (
    v_pin.project_id, v_activity_id, v_permit_type, v_uid,
    now(), now() + make_interval(hours => _valid_hours), 'active'
  )
  RETURNING id INTO v_permit_id;

  UPDATE public.live_site_activity
     SET activity_id = v_activity_id, permit_status = 'active'
   WHERE id = _pin_id;

  UPDATE public.activities SET permit_status = 'active' WHERE id = v_activity_id;

  INSERT INTO public.permit_events (permit_id, activity_id, project_id, event_type, actor_id, metadata)
  VALUES (v_permit_id, v_activity_id, v_pin.project_id, 'issued', v_uid,
          jsonb_build_object('permit_type', v_permit_type, 'valid_hours', _valid_hours, 'source', 'pin'));

  RETURN v_permit_id;
END;
$function$;

-- Backfill helper: create activity rows for legacy permit-required pins.
CREATE OR REPLACE FUNCTION public.backfill_pin_activities(_project_id uuid DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pin public.live_site_activity;
  v_id uuid;
  v_n integer := 0;
BEGIN
  FOR v_pin IN
    SELECT * FROM public.live_site_activity
     WHERE permit_required = true
       AND activity_id IS NULL
       AND status <> 'archived'
       AND (_project_id IS NULL OR project_id = _project_id)
  LOOP
    INSERT INTO public.activities (
      project_id, subcontractor_id, drawing_id, zone_id,
      description, high_risk_flags, permit_status
    ) VALUES (
      v_pin.project_id, v_pin.subcontractor_id, v_pin.drawing_id, v_pin.zone_id,
      COALESCE(
        NULLIF(btrim(concat_ws(' — ', NULLIF(btrim(COALESCE(v_pin.trade_package,'')), ''),
                                      NULLIF(btrim(COALESCE(v_pin.notes,'')), ''))), ''),
        'Site activity briefing'
      ),
      COALESCE(v_pin.high_risk_flags, ARRAY[]::text[]),
      COALESCE(v_pin.permit_status, 'required')
    )
    RETURNING id INTO v_id;

    UPDATE public.live_site_activity SET activity_id = v_id WHERE id = v_pin.id;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.backfill_pin_activities(uuid) FROM PUBLIC, anon, authenticated;