ALTER TABLE public.snags
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS snags_project_id_idx ON public.snags (project_id);

DROP POLICY IF EXISTS "Org members create snags" ON public.snags;
CREATE POLICY "Org members create snags"
ON public.snags FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(org_id, auth.uid())
  AND created_by = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.org_id = snags.org_id)
  )
);

DROP POLICY IF EXISTS "Creator or admin update snags" ON public.snags;
CREATE POLICY "Creator or admin update snags"
ON public.snags FOR UPDATE TO authenticated
USING (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid())
WITH CHECK (
  (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid())
  AND (
    project_id IS NULL
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.org_id = snags.org_id)
  )
);