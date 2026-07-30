CREATE TABLE public.ifc_model_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.project_ifc_models(id) ON DELETE CASCADE,
  global_id text NOT NULL,
  express_id integer,
  ifc_type text NOT NULL DEFAULT 'IfcBuildingElement',
  name text,
  object_type text,
  long_name text,
  storey text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, global_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifc_model_elements TO authenticated;
GRANT ALL ON public.ifc_model_elements TO service_role;

ALTER TABLE public.ifc_model_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read model elements" ON public.ifc_model_elements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = ifc_model_elements.model_id
      AND public.is_project_member(m.project_id, auth.uid())
  ));

CREATE POLICY "admins insert model elements" ON public.ifc_model_elements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = ifc_model_elements.model_id
      AND public.is_project_admin(m.project_id, auth.uid())
  ));

CREATE POLICY "admins update model elements" ON public.ifc_model_elements
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = ifc_model_elements.model_id
      AND public.is_project_admin(m.project_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = ifc_model_elements.model_id
      AND public.is_project_admin(m.project_id, auth.uid())
  ));

CREATE POLICY "admins delete model elements" ON public.ifc_model_elements
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_ifc_models m
    WHERE m.id = ifc_model_elements.model_id
      AND public.is_project_admin(m.project_id, auth.uid())
  ));

CREATE INDEX idx_ifc_model_elements_model ON public.ifc_model_elements(model_id);
CREATE INDEX idx_ifc_model_elements_type ON public.ifc_model_elements(model_id, ifc_type);

CREATE TRIGGER trg_ifc_model_elements_updated_at
  BEFORE UPDATE ON public.ifc_model_elements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();