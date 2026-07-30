-- 1. Cap trigger: exempt the platform owner (master_admin) so their seat never
--    consumes an organisation's standard seats.
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
  -- Platform owner (master_admin) seats are exempt from org seat caps.
  IF public.has_role(NEW.user_id, 'master_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_standard THEN
    IF NEW.role = 'admin' THEN
      SELECT COUNT(*) INTO std_admins FROM public.org_members
       WHERE org_id = NEW.org_id AND role='admin' AND is_standard
         AND NOT public.has_role(user_id, 'master_admin')
         AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_admins >= 1 THEN
        RAISE EXCEPTION 'ORG_ADMIN_CAP: This organisation already has an Organisation Admin.';
      END IF;
    ELSIF NEW.role = 'pm' THEN
      SELECT COUNT(*) INTO std_pms FROM public.org_members
       WHERE org_id = NEW.org_id AND role='pm' AND is_standard
         AND NOT public.has_role(user_id, 'master_admin')
         AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_pms >= 1 THEN
        RAISE EXCEPTION 'ORG_PM_CAP: This organisation already has a Project Manager.';
      END IF;
    ELSIF NEW.role = 'subcontractor' THEN
      SELECT COUNT(*) INTO std_subs FROM public.org_members
       WHERE org_id = NEW.org_id AND role='subcontractor' AND is_standard
         AND NOT public.has_role(user_id, 'master_admin')
         AND id <> COALESCE(NEW.id, gen_random_uuid());
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

-- 2. Self-heal helper: give a master_admin caller a membership row in an org
--    they are acting in, so RLS (is_org_member) works without widening policies.
CREATE OR REPLACE FUNCTION public.ensure_owner_org_membership(_org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(v_uid, 'master_admin') THEN
    RAISE EXCEPTION 'Forbidden: platform owner only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orgs WHERE id = _org_id) THEN
    RAISE EXCEPTION 'Organisation not found';
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role, is_standard)
  VALUES (_org_id, v_uid, 'admin', false)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_owner_org_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_owner_org_membership(uuid) TO authenticated, service_role;

-- 3. Backfill every master_admin into every existing organisation.
INSERT INTO public.org_members (org_id, user_id, role, is_standard)
SELECT o.id, ur.user_id, 'admin', false
FROM public.orgs o
CROSS JOIN (SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'master_admin') ur
ON CONFLICT (org_id, user_id) DO NOTHING;