CREATE OR REPLACE FUNCTION public.my_invite_companies(_project_id uuid, _user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(si.company_name)), ARRAY[]::text[])
    FROM public.subcontractor_invites si
   WHERE si.project_id = _project_id
     AND si.accepted_by = _user_id
     AND si.revoked_at IS NULL
$$;

REVOKE EXECUTE ON FUNCTION public.my_invite_companies(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_invite_companies(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Project staff and own company can view invites" ON public.subcontractor_invites;

CREATE POLICY "Project staff and own company can view invites"
ON public.subcontractor_invites
FOR SELECT
TO authenticated
USING (
  public.is_project_admin(project_id, auth.uid())
  OR public.has_role(auth.uid(), 'master_admin')
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.project_id = subcontractor_invites.project_id
       AND pm.user_id = auth.uid()
       AND pm.role_on_project IN ('site_manager','project_admin','master_admin')
  )
  OR lower(company_name) = ANY (public.my_invite_companies(project_id, auth.uid()))
);