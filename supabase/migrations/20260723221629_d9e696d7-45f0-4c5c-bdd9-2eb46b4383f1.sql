
-- 1. Widen role check constraints to allow 'pm'
ALTER TABLE public.org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE public.org_members ADD CONSTRAINT org_members_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'pm'::text, 'subcontractor'::text]));

ALTER TABLE public.org_invites DROP CONSTRAINT IF EXISTS org_invites_role_check;
ALTER TABLE public.org_invites ADD CONSTRAINT org_invites_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'pm'::text, 'subcontractor'::text]));

-- 2. Update seat-cap trigger to include the PM seat.
CREATE OR REPLACE FUNCTION public.enforce_org_member_caps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  std_admins INT;
  std_pms INT;
  std_subs INT;
BEGIN
  IF NEW.is_standard THEN
    IF NEW.role = 'admin' THEN
      SELECT COUNT(*) INTO std_admins FROM public.org_members
       WHERE org_id = NEW.org_id AND role='admin' AND is_standard AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_admins >= 1 THEN
        RAISE EXCEPTION 'ORG_ADMIN_CAP: This organisation already has an Organisation Admin.';
      END IF;
    ELSIF NEW.role = 'pm' THEN
      SELECT COUNT(*) INTO std_pms FROM public.org_members
       WHERE org_id = NEW.org_id AND role='pm' AND is_standard AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_pms >= 1 THEN
        RAISE EXCEPTION 'ORG_PM_CAP: This organisation already has a Project Manager.';
      END IF;
    ELSIF NEW.role = 'subcontractor' THEN
      SELECT COUNT(*) INTO std_subs FROM public.org_members
       WHERE org_id = NEW.org_id AND role='subcontractor' AND is_standard AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_subs >= 2 THEN
        RAISE EXCEPTION 'ORG_SUB_CAP: This organisation already has 2 standard subcontractors.';
      END IF;
    END IF;
  ELSE
    SELECT COUNT(*) INTO std_admins FROM public.org_members WHERE org_id=NEW.org_id AND role='admin' AND is_standard;
    SELECT COUNT(*) INTO std_pms    FROM public.org_members WHERE org_id=NEW.org_id AND role='pm' AND is_standard;
    SELECT COUNT(*) INTO std_subs   FROM public.org_members WHERE org_id=NEW.org_id AND role='subcontractor' AND is_standard;
    IF std_admins < 1 OR std_pms < 1 OR std_subs < 2 THEN
      RAISE EXCEPTION 'ORG_STD_INCOMPLETE: Fill all 4 standard seats (1 Org Admin + 1 PM + 2 Subs) before adding additional members.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
