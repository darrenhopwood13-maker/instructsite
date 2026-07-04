
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('master_admin', 'project_admin', 'site_manager', 'subcontractor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Master admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master_admin'));
CREATE POLICY "Master admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

-- Auto-promote the FIRST user ever to master_admin
CREATE OR REPLACE FUNCTION public.bootstrap_first_master_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_bootstrap_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_master_admin();

-- =========================================================
-- PROJECTS
-- =========================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  site_address text NOT NULL,
  scope_brief text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  master_admin_id uuid REFERENCES auth.users(id),
  project_admin_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_on_project public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, role_on_project)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helper (avoids recursive RLS on project_members)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (p.created_by = _user_id OR p.master_admin_id = _user_id OR p.project_admin_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'master_admin') OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (p.master_admin_id = _user_id OR p.project_admin_id = _user_id)
  );
$$;

CREATE POLICY "Master admins can view all projects" ON public.projects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master_admin'));
CREATE POLICY "Members can view their projects" ON public.projects
  FOR SELECT TO authenticated USING (public.is_project_member(id, auth.uid()));
CREATE POLICY "Master admins can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master_admin') AND created_by = auth.uid());
CREATE POLICY "Project admins can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_project_admin(id, auth.uid()))
  WITH CHECK (public.is_project_admin(id, auth.uid()));
CREATE POLICY "Master admins can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "View project members" ON public.project_members
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Project admins manage members" ON public.project_members
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- WORK ZONES
-- =========================================================
CREATE TABLE public.work_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text,
  source text NOT NULL DEFAULT 'manual', -- logistics | drawing | manual
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name, level)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_zones TO authenticated;
GRANT ALL ON public.work_zones TO service_role;
ALTER TABLE public.work_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view zones" ON public.work_zones
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Project admins manage zones" ON public.work_zones
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- GA DRAWINGS
-- =========================================================
CREATE TABLE public.project_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_document_id uuid NOT NULL REFERENCES public.site_documents(id) ON DELETE CASCADE,
  drawing_no text,
  revision text,
  title text,
  scale text,
  level text,
  zone text,
  is_active boolean NOT NULL DEFAULT true,
  extraction_status text NOT NULL DEFAULT 'pending', -- pending|processing|complete|failed
  extraction_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_drawings TO authenticated;
GRANT ALL ON public.project_drawings TO service_role;
ALTER TABLE public.project_drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view drawings" ON public.project_drawings
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Project admins manage drawings" ON public.project_drawings
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- LOGISTICS PLANS
-- =========================================================
CREATE TABLE public.logistics_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_document_id uuid NOT NULL REFERENCES public.site_documents(id) ON DELETE CASCADE,
  extracted_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_status text NOT NULL DEFAULT 'pending',
  extraction_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logistics_plans TO authenticated;
GRANT ALL ON public.logistics_plans TO service_role;
ALTER TABLE public.logistics_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view logistics" ON public.logistics_plans
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Project admins manage logistics" ON public.logistics_plans
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- RAMS
-- =========================================================
CREATE TABLE public.rams_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_document_id uuid NOT NULL REFERENCES public.site_documents(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  trade_package text NOT NULL,
  high_risk_flags text[] NOT NULL DEFAULT ARRAY[]::text[], -- working_at_height | hot_works | confined_space
  permit_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rams_documents TO authenticated;
GRANT ALL ON public.rams_documents TO service_role;
ALTER TABLE public.rams_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view RAMS" ON public.rams_documents
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Uploaders create own RAMS" ON public.rams_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Uploaders update own RAMS" ON public.rams_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Project admins delete RAMS" ON public.rams_documents
  FOR DELETE TO authenticated USING (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- ACTIVITIES (DABS entries)
-- =========================================================
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES auth.users(id),
  drawing_id uuid REFERENCES public.project_drawings(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES public.work_zones(id) ON DELETE SET NULL,
  description text NOT NULL,
  high_risk_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  permit_status text NOT NULL DEFAULT 'none', -- none | required | active | expired
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view project activities" ON public.activities
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create own activities" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (subcontractor_id = auth.uid() AND public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Owners or admins update activities" ON public.activities
  FOR UPDATE TO authenticated
  USING (subcontractor_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (subcontractor_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Owners or admins delete activities" ON public.activities
  FOR DELETE TO authenticated
  USING (subcontractor_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- PERMITS
-- =========================================================
CREATE TABLE public.permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
  permit_type text NOT NULL, -- working_at_height | hot_works | confined_space
  issued_by uuid REFERENCES auth.users(id),
  valid_from timestamptz,
  valid_to timestamptz,
  status text NOT NULL DEFAULT 'active', -- active | expired | revoked
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permits TO authenticated;
GRANT ALL ON public.permits TO service_role;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view permits" ON public.permits
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Project admins manage permits" ON public.permits
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- Auto flag permit_required on high-risk activities
-- =========================================================
CREATE OR REPLACE FUNCTION public.auto_flag_permit_required()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF array_length(NEW.high_risk_flags, 1) IS NOT NULL AND NEW.permit_status = 'none' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.permits pmt
      WHERE pmt.activity_id = NEW.id AND pmt.status = 'active'
        AND (pmt.valid_to IS NULL OR pmt.valid_to > now())
    ) THEN
      NEW.permit_status := 'required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER activities_auto_permit_required
  BEFORE INSERT OR UPDATE OF high_risk_flags ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.auto_flag_permit_required();

-- =========================================================
-- updated_at triggers (reuse existing function)
-- =========================================================
CREATE TRIGGER upd_projects        BEFORE UPDATE ON public.projects        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_project_drawings BEFORE UPDATE ON public.project_drawings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_logistics_plans BEFORE UPDATE ON public.logistics_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_rams_documents  BEFORE UPDATE ON public.rams_documents  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_activities      BEFORE UPDATE ON public.activities      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER upd_permits         BEFORE UPDATE ON public.permits         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.permits;
