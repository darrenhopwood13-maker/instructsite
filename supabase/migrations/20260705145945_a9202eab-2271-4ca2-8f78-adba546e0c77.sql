
-- Subcontractor invite ledger
CREATE TABLE public.subcontractor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  trade_packages text[] NOT NULL DEFAULT '{}'::text[],
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractor_invites TO authenticated;
GRANT ALL ON public.subcontractor_invites TO service_role;

ALTER TABLE public.subcontractor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project admins manage invites"
  ON public.subcontractor_invites FOR ALL
  TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE INDEX subcontractor_invites_project_idx ON public.subcontractor_invites(project_id);

-- Accept invite: called by an authenticated user who visited the link.
-- Verifies the token hash, adds project_members + subcontractor role, marks invite consumed.
CREATE OR REPLACE FUNCTION public.accept_subcontractor_invite(_token_hash text)
RETURNS TABLE(project_id uuid, trade_packages text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.subcontractor_invites;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv
    FROM public.subcontractor_invites
   WHERE token_hash = _token_hash
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite revoked';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role_on_project)
  VALUES (v_inv.project_id, v_uid, 'subcontractor')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'subcontractor')
  ON CONFLICT DO NOTHING;

  IF v_inv.accepted_by IS NULL THEN
    UPDATE public.subcontractor_invites
       SET accepted_by = v_uid, accepted_at = now()
     WHERE id = v_inv.id;
  END IF;

  RETURN QUERY SELECT v_inv.project_id, v_inv.trade_packages;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_subcontractor_invite(text) TO authenticated;
