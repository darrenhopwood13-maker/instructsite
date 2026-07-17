
-- Add is_standard flag to org_members
ALTER TABLE public.org_members ADD COLUMN IF NOT EXISTS is_standard BOOLEAN NOT NULL DEFAULT true;

-- Org invites table
CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','subcontractor')),
  is_standard BOOLEAN NOT NULL DEFAULT true,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by UUID,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_invites_org_id_idx ON public.org_invites(org_id);
CREATE INDEX IF NOT EXISTS org_invites_email_idx ON public.org_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invites TO authenticated;
GRANT ALL ON public.org_invites TO service_role;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder or org admins view invites" ON public.org_invites FOR SELECT TO authenticated
  USING (
    lower(COALESCE(auth.jwt() ->> 'email','')) = 'darrenhopwood13@gmail.com'
    OR public.is_org_admin(org_id, auth.uid())
  );
CREATE POLICY "Founder or org admins manage invites" ON public.org_invites FOR ALL TO authenticated
  USING (
    lower(COALESCE(auth.jwt() ->> 'email','')) = 'darrenhopwood13@gmail.com'
    OR public.is_org_admin(org_id, auth.uid())
  )
  WITH CHECK (
    lower(COALESCE(auth.jwt() ->> 'email','')) = 'darrenhopwood13@gmail.com'
    OR public.is_org_admin(org_id, auth.uid())
  );
CREATE POLICY "Invitee sees invite by token via function" ON public.org_invites FOR SELECT TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email','')));

-- Replace cap trigger: enforce standard caps; allow non-standard only after 3 standard filled
CREATE OR REPLACE FUNCTION public.enforce_org_member_caps()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  std_admins INT;
  std_subs INT;
BEGIN
  IF NEW.is_standard THEN
    IF NEW.role = 'admin' THEN
      SELECT COUNT(*) INTO std_admins FROM public.org_members
       WHERE org_id = NEW.org_id AND role='admin' AND is_standard AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_admins >= 1 THEN
        RAISE EXCEPTION 'ORG_ADMIN_CAP: This organisation already has a Project Manager.';
      END IF;
    ELSIF NEW.role = 'subcontractor' THEN
      SELECT COUNT(*) INTO std_subs FROM public.org_members
       WHERE org_id = NEW.org_id AND role='subcontractor' AND is_standard AND id <> COALESCE(NEW.id, gen_random_uuid());
      IF std_subs >= 2 THEN
        RAISE EXCEPTION 'ORG_SUB_CAP: This organisation already has 2 standard subcontractors.';
      END IF;
    END IF;
  ELSE
    -- non-standard: require all 3 standard seats already claimed
    SELECT COUNT(*) INTO std_admins FROM public.org_members WHERE org_id=NEW.org_id AND role='admin' AND is_standard;
    SELECT COUNT(*) INTO std_subs   FROM public.org_members WHERE org_id=NEW.org_id AND role='subcontractor' AND is_standard;
    IF std_admins < 1 OR std_subs < 2 THEN
      RAISE EXCEPTION 'ORG_STD_INCOMPLETE: Fill all 3 standard seats (1 PM + 2 Subs) before adding additional members.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Accept invite via security definer (bypasses org_members RLS)
CREATE OR REPLACE FUNCTION public.accept_org_invite(_token UUID)
RETURNS TABLE(org_id UUID, role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email',''));
  v_inv public.org_invites;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.org_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invite % ', v_inv.status; END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'This invite is for %', v_inv.email;
  END IF;

  INSERT INTO public.org_members(org_id, user_id, role, is_standard)
  VALUES (v_inv.org_id, v_uid, v_inv.role, v_inv.is_standard)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.org_invites
     SET status='accepted', accepted_by=v_uid, accepted_at=now()
   WHERE id = v_inv.id;

  RETURN QUERY SELECT v_inv.org_id, v_inv.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_org_invite(UUID) TO authenticated;

-- updated_at trigger for invites not needed (immutable status change tracked via accepted_at)
