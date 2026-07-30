ALTER TABLE public.live_site_activity
  ADD COLUMN IF NOT EXISTS hazard_scanned boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.detect_pin_high_risk()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_text text;
  v_flags text[] := ARRAY[]::text[];
BEGIN
  v_text := lower(coalesce(NEW.trade_package,'') || ' ' || coalesce(NEW.notes,''));

  IF v_text ~ '(hot\s*work|welding|cutting torch|grinding|brazing|soldering|oxy[- ]?acetylene|naked flame)' THEN
    v_flags := array_append(v_flags, 'hot_works');
  END IF;
  IF v_text ~ '(confined\s*space|tank entry|manhole|vessel entry|chamber entry)' THEN
    v_flags := array_append(v_flags, 'confined_space');
  END IF;
  IF v_text ~ '(work(ing)?\s*at\s*height|scaffold|roof(ing)?|mewp|cherry\s*picker|ladder work|edge protection|fall(ing)? from height|leading edge)' THEN
    v_flags := array_append(v_flags, 'working_at_height');
  END IF;
  IF v_text ~ '(excavat(ion|ing)|dig(ging)?|trench|groundworks|underground service|buried service)' THEN
    v_flags := array_append(v_flags, 'excavation');
  END IF;
  IF v_text ~ '(1\.2\s*m|1\.5\s*m|2\s*m|deep excavat|deep trench|shoring|trench box|shored)' THEN
    v_flags := array_append(v_flags, 'deep_excavation');
  END IF;
  IF v_text ~ '(lift(ing)? operation|loler|mobile\s*crane|tower\s*crane|crawler\s*crane|contract\s*lift|tandem lift|hiab|lorry loader|telehandler|slinger|banksman|rigger|lift\s*plan|lifting\s*plan|steel(work)?\s*erect|beam\s*lift|precast\s*lift|structural\s*steel)' THEN
    v_flags := array_append(v_flags, 'lifting_operations');
  END IF;
  IF v_text ~ '(overhead\s*(power\s*)?line|overhead\s*cable|hv\s*cable|11\s*kv|33\s*kv|400\s*kv|live\s*(cable|conductor|overhead)|gs6|exclusion\s*zone|proximity to overhead)' THEN
    v_flags := array_append(v_flags, 'overhead_powerlines');
  END IF;
  IF v_text ~ '(demolition|soft strip|structural strip|controlled collapse)' THEN
    v_flags := array_append(v_flags, 'demolition');
  END IF;

  -- merge any client-supplied flags
  SELECT COALESCE(array_agg(DISTINCT f), ARRAY[]::text[])
    INTO v_flags
    FROM unnest(v_flags || COALESCE(NEW.high_risk_flags, ARRAY[]::text[])) AS f
   WHERE f IS NOT NULL AND f <> '';

  NEW.high_risk_flags := v_flags;
  NEW.hazard_scanned := true;

  IF array_length(v_flags, 1) IS NOT NULL THEN
    IF COALESCE(NEW.permit_status, 'none') = 'none' THEN
      NEW.permit_required := true;
      NEW.permit_status := 'required';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_detect_pin_high_risk ON public.live_site_activity;
CREATE TRIGGER trg_detect_pin_high_risk
BEFORE INSERT OR UPDATE OF trade_package, notes, high_risk_flags
ON public.live_site_activity
FOR EACH ROW EXECUTE FUNCTION public.detect_pin_high_risk();

-- backfill existing pins through the detector
UPDATE public.live_site_activity
   SET trade_package = trade_package
 WHERE hazard_scanned = false;