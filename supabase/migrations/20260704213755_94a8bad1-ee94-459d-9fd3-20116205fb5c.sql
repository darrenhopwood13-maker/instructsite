
CREATE POLICY "Project members upload diary photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'diary-photos'
    AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Project members read diary photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'diary-photos'
    AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Project admins delete diary photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'diary-photos'
    AND public.is_project_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );
