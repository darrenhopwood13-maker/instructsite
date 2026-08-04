ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS photo_path text;

CREATE OR REPLACE FUNCTION public.can_manage_project_photo(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_project_admin(_project_id, _user_id)
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
         WHERE pm.project_id = _project_id
           AND pm.user_id = _user_id
           AND pm.role_on_project IN ('site_manager','project_admin','master_admin')
      );
$$;

DROP POLICY IF EXISTS "project photos viewable by members" ON storage.objects;
CREATE POLICY "project photos viewable by members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-photos'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "project photos insert by managers" ON storage.objects;
CREATE POLICY "project photos insert by managers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-photos'
  AND public.can_manage_project_photo(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "project photos update by managers" ON storage.objects;
CREATE POLICY "project photos update by managers"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-photos'
  AND public.can_manage_project_photo(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "project photos delete by managers" ON storage.objects;
CREATE POLICY "project photos delete by managers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-photos'
  AND public.can_manage_project_photo(((storage.foldername(name))[1])::uuid, auth.uid())
);