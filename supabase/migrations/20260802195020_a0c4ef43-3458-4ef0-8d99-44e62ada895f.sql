CREATE OR REPLACE FUNCTION public.issue_activity_permit(
  _activity_id uuid,
  _permit_type text,
  _valid_hours integer DEFAULT 8
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  UPDATE public.live_site_activity
     SET permit_status = 'active'
   WHERE activity_id = _activity_id;

  RETURN v_permit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_permit(_permit_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    UPDATE public.activities
       SET permit_status = 'required',
           description = CASE
             WHEN COALESCE(btrim(_reason), '') = '' THEN description
             ELSE description || E'\n[Permit revoked] ' || btrim(_reason)
           END
     WHERE id = v_p.activity_id;

    UPDATE public.live_site_activity
       SET permit_status = 'required'
     WHERE activity_id = v_p.activity_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_activity_permit(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_permit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_activity_permit(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_permit(uuid, text) TO authenticated;