-- 1. Remove privilege-escalation backdoor
DROP FUNCTION IF EXISTS public.dev_claim_master_admin(uuid);

-- 2. Project-scoped read access to extracted document content
DROP POLICY IF EXISTS "Users can view content for their own documents" ON public.document_contents;
CREATE POLICY "Members view document content"
  ON public.document_contents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_documents d
      WHERE d.id = document_contents.document_id
        AND (d.uploaded_by = auth.uid() OR public.can_view_site_document(d.id, auth.uid()))
    )
  );

-- 3. Clean up owning site_documents when a project is deleted
CREATE OR REPLACE FUNCTION public.cleanup_project_site_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.site_documents sd
   WHERE sd.id IN (
     SELECT site_document_id FROM public.project_drawings      WHERE project_id = OLD.id
     UNION SELECT site_document_id FROM public.logistics_plans  WHERE project_id = OLD.id
     UNION SELECT site_document_id FROM public.rams_documents   WHERE project_id = OLD.id
     UNION SELECT site_document_id FROM public.project_bible_reports WHERE project_id = OLD.id
   );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_project_site_documents ON public.projects;
CREATE TRIGGER trg_cleanup_project_site_documents
  BEFORE DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_project_site_documents();

-- 4. Regression check: any FK pointing at projects that is not ON DELETE CASCADE/SET NULL
CREATE OR REPLACE FUNCTION public.project_delete_cascade_gaps()
RETURNS TABLE(child_table text, child_column text, delete_rule text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.conrelid::regclass::text,
         a.attname::text,
         CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                            WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                            WHEN 'd' THEN 'SET DEFAULT' END
    FROM pg_constraint c
    JOIN unnest(c.conkey) k ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
   WHERE c.contype = 'f'
     AND c.connamespace = 'public'::regnamespace
     AND c.confrelid = 'public.projects'::regclass
     AND c.confdeltype NOT IN ('c','n');
$$;

REVOKE ALL ON FUNCTION public.project_delete_cascade_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_delete_cascade_gaps() TO service_role;