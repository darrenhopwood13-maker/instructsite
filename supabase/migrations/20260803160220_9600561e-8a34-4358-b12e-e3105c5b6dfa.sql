CREATE POLICY "site managers manage programme_package_links"
  ON public.programme_package_links FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = programme_package_links.project_id
        AND pm.user_id = auth.uid()
        AND pm.role_on_project = 'site_manager'::public.app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = programme_package_links.project_id
        AND pm.user_id = auth.uid()
        AND pm.role_on_project = 'site_manager'::public.app_role
    )
  );