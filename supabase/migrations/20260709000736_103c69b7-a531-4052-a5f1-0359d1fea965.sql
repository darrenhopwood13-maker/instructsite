
-- programme-uploads bucket policies
CREATE POLICY "Project admins can upload programmes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'programme-uploads'
    AND public.is_project_admin(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project members can read programme uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'programme-uploads'
    AND public.is_project_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project admins can delete programmes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'programme-uploads'
    AND public.is_project_admin(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- programme_uploads: track storage + status
ALTER TABLE public.programme_uploads
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';
