
-- 1. Extend live_site_activity with permit fields
ALTER TABLE public.live_site_activity
  ADD COLUMN IF NOT EXISTS permit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS high_risk_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL;

-- 2. Auto-detect high-risk keywords from trade_package + notes
CREATE OR REPLACE FUNCTION public.detect_pin_high_risk()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_text text;
  v_flags text[] := ARRAY[]::text[];
BEGIN
  v_text := lower(coalesce(NEW.trade_package,'') || ' ' || coalesce(NEW.notes,''));

  IF v_text ~ '(hot\s*work|welding|cutting torch|grinding|brazing|soldering)' THEN
    v_flags := array_append(v_flags, 'hot_works');
  END IF;
  IF v_text ~ '(confined\s*space|tank entry|manhole|vessel entry)' THEN
    v_flags := array_append(v_flags, 'confined_space');
  END IF;
  IF v_text ~ '(work(ing)?\s*at\s*height|scaffold|roof|mewp|cherry\s*picker|ladder work|edge protection)' THEN
    v_flags := array_append(v_flags, 'working_at_height');
  END IF;
  IF v_text ~ '(excavation|dig(ging)?|trench|groundworks|underground service)' THEN
    v_flags := array_append(v_flags, 'excavation');
  END IF;

  IF array_length(v_flags, 1) IS NOT NULL THEN
    NEW.high_risk_flags := v_flags;
    IF NEW.permit_status = 'none' THEN
      NEW.permit_required := true;
      NEW.permit_status := 'required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_pin_high_risk ON public.live_site_activity;
CREATE TRIGGER trg_detect_pin_high_risk
BEFORE INSERT OR UPDATE OF trade_package, notes ON public.live_site_activity
FOR EACH ROW EXECUTE FUNCTION public.detect_pin_high_risk();

-- 3. Server-side permit issuance (creates activity + permit rows, updates pin)
CREATE OR REPLACE FUNCTION public.issue_pin_permit(
  _pin_id uuid,
  _valid_hours integer DEFAULT 8
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pin public.live_site_activity;
  v_activity_id uuid;
  v_permit_id uuid;
  v_permit_type text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_pin FROM public.live_site_activity WHERE id = _pin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pin not found';
  END IF;

  -- Authorization: master_admin / project_admin / site_manager only
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

  -- Reuse or create linked activity
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
    project_id, activity_id, permit_type, issued_by,
    valid_from, valid_to, status
  ) VALUES (
    v_pin.project_id, v_activity_id, v_permit_type, v_uid,
    now(), now() + make_interval(hours => _valid_hours), 'active'
  )
  RETURNING id INTO v_permit_id;

  UPDATE public.live_site_activity
     SET activity_id = v_activity_id,
         permit_status = 'active'
   WHERE id = _pin_id;

  UPDATE public.activities SET permit_status = 'active' WHERE id = v_activity_id;

  RETURN v_permit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_pin_permit(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_pin_permit(uuid, integer) TO service_role;
