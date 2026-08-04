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
  OR EXISTS (
    SELECT 1 FROM public.subcontractor_invites mine
     WHERE mine.project_id = subcontractor_invites.project_id
       AND mine.accepted_by = auth.uid()
       AND lower(mine.company_name) = lower(subcontractor_invites.company_name)
  )
);