CREATE TABLE public.subcontractor_pack_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  org_id uuid,
  range_start date,
  range_end date,
  version integer NOT NULL DEFAULT 1,
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  byte_size bigint,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subcontractor_pack_issues_version_key
  ON public.subcontractor_pack_issues (project_id, subcontractor_id, COALESCE(range_start,'0001-01-01'::date), COALESCE(range_end,'9999-12-31'::date), version);
CREATE INDEX subcontractor_pack_issues_project_idx ON public.subcontractor_pack_issues (project_id, generated_at DESC);
CREATE INDEX subcontractor_pack_issues_sub_idx ON public.subcontractor_pack_issues (subcontractor_id, generated_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.subcontractor_pack_issues TO authenticated;
GRANT ALL ON public.subcontractor_pack_issues TO service_role;

ALTER TABLE public.subcontractor_pack_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can read pack issues"
  ON public.subcontractor_pack_issues FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can create pack issues"
  ON public.subcontractor_pack_issues FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND generated_by = auth.uid());

CREATE POLICY "Issuers can update their own pack issues"
  ON public.subcontractor_pack_issues FOR UPDATE TO authenticated
  USING (generated_by = auth.uid() AND public.is_project_member(project_id, auth.uid()))
  WITH CHECK (generated_by = auth.uid() AND public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER update_subcontractor_pack_issues_updated_at
  BEFORE UPDATE ON public.subcontractor_pack_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Project members can read pack files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'subcontractor-packs'
    AND EXISTS (
      SELECT 1 FROM public.subcontractor_pack_issues i
      WHERE i.storage_path = storage.objects.name
        AND public.is_project_member(i.project_id, auth.uid())
    )
  );

CREATE POLICY "Project members can upload pack files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subcontractor-packs'
    AND public.is_project_member((split_part(name, '/', 1))::uuid, auth.uid())
  );