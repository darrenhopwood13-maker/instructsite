CREATE POLICY "Project admins can insert programme jobs" ON public.programme_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Project admins can update programme jobs" ON public.programme_jobs
  FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "Project admins can insert programme uploads" ON public.programme_uploads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()) AND uploaded_by = auth.uid());