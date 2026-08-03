-- 1. seat_role gains a real 'pm' value
ALTER TABLE public.subcontractor_invites
  ADD CONSTRAINT subcontractor_invites_seat_role_chk
  CHECK (seat_role IN ('pm', 'admin', 'read_only'));

-- 2. Seat caps: 1 pm + 1 admin + 2 read_only = 4
CREATE OR REPLACE FUNCTION public.enforce_subcontractor_seat_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_pm_count INT;
  v_admin_count INT;
  v_readonly_count INT;
BEGIN
  IF NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE seat_role = 'pm'),
    COUNT(*) FILTER (WHERE seat_role = 'admin'),
    COUNT(*) FILTER (WHERE seat_role = 'read_only')
  INTO v_pm_count, v_admin_count, v_readonly_count
  FROM public.subcontractor_invites
  WHERE project_id = NEW.project_id
    AND lower(company_name) = lower(NEW.company_name)
    AND revoked_at IS NULL
    AND (accepted_at IS NOT NULL OR expires_at > now())
    AND id <> NEW.id;

  IF NEW.seat_role = 'pm' AND v_pm_count >= 1 THEN
    RAISE EXCEPTION 'SEAT_CAP_PM: This subcontractor already has a PM seat.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.seat_role = 'admin' AND v_admin_count >= 1 THEN
    RAISE EXCEPTION 'SEAT_CAP_ADMIN: This subcontractor already has an admin seat.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.seat_role = 'read_only' AND v_readonly_count >= 2 THEN
    RAISE EXCEPTION 'SEAT_CAP_READONLY: Maximum capacity reached (2 read-only seats).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (v_pm_count + v_admin_count + v_readonly_count + 1) > 4 THEN
    RAISE EXCEPTION 'SEAT_CAP_TOTAL: Maximum capacity reached (4 seats per subcontractor).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Seat usage now reports the PM seat too
DROP FUNCTION IF EXISTS public.subcontractor_seat_usage(uuid, text);
CREATE FUNCTION public.subcontractor_seat_usage(_project_id uuid, _company_name text)
RETURNS TABLE(pm_used integer, admin_used integer, readonly_used integer, pm_cap integer, admin_cap integer, readonly_cap integer, total_cap integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (WHERE seat_role = 'pm')::INT,
    COUNT(*) FILTER (WHERE seat_role = 'admin')::INT,
    COUNT(*) FILTER (WHERE seat_role = 'read_only')::INT,
    1, 1, 2, 4
  FROM public.subcontractor_invites
  WHERE project_id = _project_id
    AND lower(company_name) = lower(_company_name)
    AND revoked_at IS NULL
    AND (accepted_at IS NOT NULL OR expires_at > now());
$function$;

-- 4. Designating the PM seat (project staff only, one per company per project)
CREATE OR REPLACE FUNCTION public.designate_subcontractor_pm_seat(_invite_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.subcontractor_invites;
  v_old public.subcontractor_invites;
  v_admin_used INT;
  v_ro_used INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.subcontractor_invites WHERE id = _invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found.'; END IF;
  IF v_inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'That seat has been revoked.'; END IF;

  IF NOT (
    public.is_project_admin(v_inv.project_id, v_uid)
    OR public.has_role(v_uid, 'master_admin')
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
       WHERE pm.project_id = v_inv.project_id
         AND pm.user_id = v_uid
         AND pm.role_on_project IN ('site_manager','project_admin','master_admin')
    )
  ) THEN
    RAISE EXCEPTION 'Only a project admin or site manager can designate the PM seat.';
  END IF;

  IF v_inv.seat_role = 'pm' THEN RETURN 'unchanged'; END IF;

  SELECT * INTO v_old
    FROM public.subcontractor_invites
   WHERE project_id = v_inv.project_id
     AND lower(company_name) = lower(v_inv.company_name)
     AND revoked_at IS NULL
     AND seat_role = 'pm'
   LIMIT 1;

  IF FOUND THEN
    SELECT
      COUNT(*) FILTER (WHERE seat_role = 'admin'),
      COUNT(*) FILTER (WHERE seat_role = 'read_only')
      INTO v_admin_used, v_ro_used
      FROM public.subcontractor_invites
     WHERE project_id = v_inv.project_id
       AND lower(company_name) = lower(v_inv.company_name)
       AND revoked_at IS NULL
       AND id <> v_old.id
       AND id <> v_inv.id;

    IF v_admin_used < 1 THEN
      UPDATE public.subcontractor_invites SET seat_role = 'admin' WHERE id = v_old.id;
    ELSIF v_ro_used < 2 THEN
      UPDATE public.subcontractor_invites SET seat_role = 'read_only' WHERE id = v_old.id;
    ELSE
      RAISE EXCEPTION 'SEAT_NO_ROOM: no free seat to move the current PM into. Revoke a seat first.';
    END IF;
  END IF;

  UPDATE public.subcontractor_invites SET seat_role = 'pm' WHERE id = _invite_id;
  RETURN 'pm';
END;
$function$;

-- 5. Short-term programme sign-off requires the PM seat specifically
CREATE OR REPLACE FUNCTION public.stp_role_for(_programme_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_p public.short_term_programmes;
BEGIN
  SELECT * INTO v_p FROM public.short_term_programmes WHERE id = _programme_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM public.subcontractor_invites si
     WHERE si.project_id = v_p.project_id
       AND si.revoked_at IS NULL
       AND si.seat_role = 'pm'
       AND si.accepted_by = _user_id
       AND lower(si.company_name) = lower(v_p.company_name)
  ) THEN
    RETURN 'subcontractor_pm';
  END IF;

  IF public.is_project_admin(v_p.project_id, _user_id)
     OR public.has_role(_user_id, 'master_admin')
     OR EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = v_p.project_id
          AND pm.user_id = _user_id
          AND pm.role_on_project IN ('site_manager','project_admin','master_admin')
     )
  THEN
    RETURN 'site_manager';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_short_term_programme(_programme_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_p public.short_term_programmes;
  v_sm_ok boolean;
  v_sub_ok boolean;
  v_accepted integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_p FROM public.short_term_programmes WHERE id = _programme_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programme not found.'; END IF;
  IF v_p.status = 'draft' THEN
    RAISE EXCEPTION 'This programme has not been sent for approval yet.';
  END IF;
  IF v_p.status = 'accepted' THEN RETURN 'accepted'; END IF;

  v_role := public.stp_role_for(_programme_id, v_uid);
  IF v_role IS NULL THEN RAISE EXCEPTION 'You cannot accept this programme.'; END IF;

  -- The subcontractor side can only ever be signed by the company's accepted
  -- PM seat. An admin seat is explicitly not sufficient.
  IF v_role = 'site_manager' AND NOT EXISTS (
    SELECT 1 FROM public.subcontractor_invites si
     WHERE si.project_id = v_p.project_id
       AND si.revoked_at IS NULL
       AND si.seat_role = 'pm'
       AND si.accepted_by IS NOT NULL
       AND lower(si.company_name) = lower(v_p.company_name)
  ) THEN
    RAISE EXCEPTION 'STP_NO_PM: % has nobody holding the PM seat on this project yet, so they cannot counter-sign. Designate their PM seat first.', v_p.company_name;
  END IF;

  IF v_role = 'site_manager' THEN
    UPDATE public.short_term_programmes
       SET site_manager_accepted_at = now(), site_manager_accepted_by = v_uid
     WHERE id = _programme_id;
  ELSE
    UPDATE public.short_term_programmes
       SET subcontractor_accepted_at = now(), subcontractor_accepted_by = v_uid
     WHERE id = _programme_id;
  END IF;

  SELECT site_manager_accepted_at IS NOT NULL, subcontractor_accepted_at IS NOT NULL
    INTO v_sm_ok, v_sub_ok
    FROM public.short_term_programmes WHERE id = _programme_id;

  IF v_sm_ok AND v_sub_ok THEN
    SELECT count(*) INTO v_accepted
      FROM public.short_term_programmes p
     WHERE p.project_id = v_p.project_id
       AND lower(p.company_name) = lower(v_p.company_name)
       AND lower(p.package_label) = lower(v_p.package_label)
       AND p.status = 'accepted';

    IF v_accepted >= 5 THEN
      RAISE EXCEPTION 'STP_CAP: % already has 5 accepted short-term programmes for %. Nothing further can be accepted for this package.', v_p.company_name, v_p.package_label;
    END IF;

    UPDATE public.short_term_programmes SET status = 'accepted' WHERE id = _programme_id;
    RETURN 'accepted';
  END IF;

  RETURN CASE WHEN v_sm_ok THEN 'awaiting_subcontractor' ELSE 'awaiting_site_manager' END;
END;
$function$;