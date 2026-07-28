DROP POLICY IF EXISTS "Users create their own site documents" ON public.site_documents;

CREATE POLICY "Users create their own site documents"
  ON public.site_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'master_admin')
      OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.org_members om   WHERE om.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.created_by = auth.uid()
           OR p.master_admin_id = auth.uid()
           OR p.project_admin_id = auth.uid()
      )
    )
  );