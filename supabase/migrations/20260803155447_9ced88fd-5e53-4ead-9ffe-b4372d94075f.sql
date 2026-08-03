ALTER TABLE public.programme_reference_tasks ADD COLUMN IF NOT EXISTS package_ref text;

CREATE TABLE public.programme_package_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_label text NOT NULL,
  package_key text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_package_links TO authenticated;
GRANT ALL ON public.programme_package_links TO service_role;

CREATE UNIQUE INDEX programme_package_links_unique
  ON public.programme_package_links (project_id, lower(source_label));

ALTER TABLE public.programme_package_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view programme_package_links"
  ON public.programme_package_links FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "admins manage programme_package_links"
  ON public.programme_package_links FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER update_programme_package_links_updated_at
  BEFORE UPDATE ON public.programme_package_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();