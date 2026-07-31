CREATE OR REPLACE FUNCTION public.list_project_subcontractor_directory(_project_id uuid)
RETURNS TABLE(
  id uuid,
  company_name text,
  trade_packages text[],
  pm_name text,
  supervisor_name text,
  accepted_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.company_name, i.trade_packages, i.pm_name, i.supervisor_name,
         i.accepted_at, i.created_at
    FROM public.subcontractor_invites i
   WHERE i.project_id = _project_id
     AND i.revoked_at IS NULL
     AND public.is_project_member(_project_id, auth.uid())
   ORDER BY i.company_name;
$$;

REVOKE ALL ON FUNCTION public.list_project_subcontractor_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_subcontractor_directory(uuid) TO authenticated;