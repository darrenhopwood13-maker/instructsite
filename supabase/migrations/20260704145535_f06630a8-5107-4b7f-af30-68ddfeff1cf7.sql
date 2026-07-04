
CREATE OR REPLACE FUNCTION public.site_document_project_ids(_document_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.project_drawings WHERE site_document_id = _document_id
  UNION
  SELECT project_id FROM public.logistics_plans   WHERE site_document_id = _document_id
  UNION
  SELECT project_id FROM public.rams_documents    WHERE site_document_id = _document_id
$$;

CREATE OR REPLACE FUNCTION public.can_view_site_document(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_document_project_ids(_document_id) pid
    WHERE public.is_project_member(pid, _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_admin_site_document(_document_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_document_project_ids(_document_id) pid
    WHERE public.is_project_admin(pid, _user_id)
  );
$$;

DROP POLICY IF EXISTS "Users can view their own site documents" ON public.site_documents;
DROP POLICY IF EXISTS "Users can create their own site documents" ON public.site_documents;
DROP POLICY IF EXISTS "Users can update their own site documents" ON public.site_documents;
DROP POLICY IF EXISTS "Users can delete their own site documents" ON public.site_documents;

CREATE POLICY "Members view site documents"
  ON public.site_documents FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.can_view_site_document(id, auth.uid())
  );

CREATE POLICY "Users create their own site documents"
  ON public.site_documents FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins or uploader update site documents"
  ON public.site_documents FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.can_admin_site_document(id, auth.uid())
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR public.can_admin_site_document(id, auth.uid())
  );

CREATE POLICY "Admins or uploader delete site documents"
  ON public.site_documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.can_admin_site_document(id, auth.uid())
  );
