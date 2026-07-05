
-- project_ifc_models: registers uploaded IFC files per project
CREATE TABLE public.project_ifc_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_ifc_models_active_uidx
  ON public.project_ifc_models(project_id)
  WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ifc_models TO authenticated;
GRANT ALL ON public.project_ifc_models TO service_role;
ALTER TABLE public.project_ifc_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ifc models" ON public.project_ifc_models
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "admins insert ifc models" ON public.project_ifc_models
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "admins update ifc models" ON public.project_ifc_models
  FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "admins delete ifc models" ON public.project_ifc_models
  FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER trg_project_ifc_models_updated_at
  BEFORE UPDATE ON public.project_ifc_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ifc_element_mappings: maps IFC GlobalId → work_zone
CREATE TABLE public.ifc_element_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.project_ifc_models(id) ON DELETE CASCADE,
  global_id TEXT NOT NULL,
  zone_id UUID NOT NULL REFERENCES public.work_zones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, global_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifc_element_mappings TO authenticated;
GRANT ALL ON public.ifc_element_mappings TO service_role;
ALTER TABLE public.ifc_element_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read mappings" ON public.ifc_element_mappings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = model_id AND public.is_project_member(m.project_id, auth.uid())
  ));

CREATE POLICY "admins insert mappings" ON public.ifc_element_mappings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = model_id AND public.is_project_admin(m.project_id, auth.uid())
  ));

CREATE POLICY "admins update mappings" ON public.ifc_element_mappings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = model_id AND public.is_project_admin(m.project_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = model_id AND public.is_project_admin(m.project_id, auth.uid())
  ));

CREATE POLICY "admins delete mappings" ON public.ifc_element_mappings
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = model_id AND public.is_project_admin(m.project_id, auth.uid())
  ));

CREATE TRIGGER trg_ifc_element_mappings_updated_at
  BEFORE UPDATE ON public.ifc_element_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for the project-bim-models bucket
CREATE POLICY "members read bim files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-bim-models'
    AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "admins upload bim files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-bim-models'
    AND public.is_project_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "admins update bim files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-bim-models'
    AND public.is_project_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "admins delete bim files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-bim-models'
    AND public.is_project_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  );
