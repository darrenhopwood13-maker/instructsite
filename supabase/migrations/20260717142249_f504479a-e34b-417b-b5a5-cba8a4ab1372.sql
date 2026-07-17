
CREATE TABLE public.subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  manager_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractors TO authenticated;
GRANT ALL ON public.subcontractors TO service_role;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view subcontractors" ON public.subcontractors FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Admins insert subcontractors" ON public.subcontractors FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins update subcontractors" ON public.subcontractors FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins delete subcontractors" ON public.subcontractors FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));
CREATE TRIGGER update_subcontractors_updated_at BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_subcontractors_project ON public.subcontractors(project_id);

CREATE OR REPLACE FUNCTION public.subcontractor_project_id(_sub_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT project_id FROM public.subcontractors WHERE id = _sub_id $$;

CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  competency_card_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view workers" ON public.workers FOR SELECT TO authenticated
  USING (public.is_project_member(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins insert workers" ON public.workers FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins update workers" ON public.workers FOR UPDATE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()))
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins delete workers" ON public.workers FOR DELETE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_workers_sub ON public.workers(subcontractor_id);

CREATE TABLE public.registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('PUWER','LOLER','HAVS','Plant')),
  asset_name text,
  inspection_date date,
  certificate_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registers TO authenticated;
GRANT ALL ON public.registers TO service_role;
ALTER TABLE public.registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view registers" ON public.registers FOR SELECT TO authenticated
  USING (public.is_project_member(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins insert registers" ON public.registers FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins update registers" ON public.registers FOR UPDATE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()))
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins delete registers" ON public.registers FOR DELETE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE TRIGGER update_registers_updated_at BEFORE UPDATE ON public.registers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_registers_sub ON public.registers(subcontractor_id);

CREATE TABLE public.toolbox_talks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  topic text,
  attendance_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_talks TO authenticated;
GRANT ALL ON public.toolbox_talks TO service_role;
ALTER TABLE public.toolbox_talks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view toolbox_talks" ON public.toolbox_talks FOR SELECT TO authenticated
  USING (public.is_project_member(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins insert toolbox_talks" ON public.toolbox_talks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins update toolbox_talks" ON public.toolbox_talks FOR UPDATE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()))
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins delete toolbox_talks" ON public.toolbox_talks FOR DELETE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE TRIGGER update_toolbox_talks_updated_at BEFORE UPDATE ON public.toolbox_talks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_toolbox_talks_sub ON public.toolbox_talks(subcontractor_id);

CREATE TABLE public.look_aheads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  work_plan text,
  is_high_risk boolean NOT NULL DEFAULT false,
  permit_required boolean NOT NULL DEFAULT false,
  date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.look_aheads TO authenticated;
GRANT ALL ON public.look_aheads TO service_role;
ALTER TABLE public.look_aheads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view look_aheads" ON public.look_aheads FOR SELECT TO authenticated
  USING (public.is_project_member(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins insert look_aheads" ON public.look_aheads FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins update look_aheads" ON public.look_aheads FOR UPDATE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()))
  WITH CHECK (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE POLICY "Admins delete look_aheads" ON public.look_aheads FOR DELETE TO authenticated
  USING (public.is_project_admin(public.subcontractor_project_id(subcontractor_id), auth.uid()));
CREATE TRIGGER update_look_aheads_updated_at BEFORE UPDATE ON public.look_aheads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_look_aheads_sub ON public.look_aheads(subcontractor_id);

CREATE POLICY "Auth users read compliance-docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'compliance-docs');
CREATE POLICY "Auth users write compliance-docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'compliance-docs');
CREATE POLICY "Auth users update compliance-docs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'compliance-docs');
CREATE POLICY "Auth users delete compliance-docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'compliance-docs');
