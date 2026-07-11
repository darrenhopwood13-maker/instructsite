
-- ORGS
CREATE TABLE public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgs TO authenticated;
GRANT ALL ON public.orgs TO service_role;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- ORG MEMBERS
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','subcontractor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX org_members_user_id_idx ON public.org_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = _user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.org_admin_count(_org_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.org_members WHERE org_id = _org_id AND role = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.enforce_org_member_caps()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' AND (SELECT COUNT(*) FROM public.org_members WHERE org_id = NEW.org_id AND role = 'admin' AND id <> COALESCE(NEW.id, gen_random_uuid())) >= 1 THEN
    RAISE EXCEPTION 'ORG_ADMIN_CAP: This organisation already has an admin.';
  END IF;
  IF NEW.role = 'subcontractor' AND (SELECT COUNT(*) FROM public.org_members WHERE org_id = NEW.org_id AND role = 'subcontractor' AND id <> COALESCE(NEW.id, gen_random_uuid())) >= 2 THEN
    RAISE EXCEPTION 'ORG_SUB_CAP: This organisation already has 2 subcontractors.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_org_member_caps_trg
  BEFORE INSERT OR UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_member_caps();

CREATE POLICY "Members view their orgs" ON public.orgs FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "Authenticated can create orgs" ON public.orgs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members view org membership" ON public.org_members FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Admins or self-claim add members" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'admin' AND public.org_admin_count(org_id) = 0)
    OR public.is_org_admin(org_id, auth.uid())
  );
CREATE POLICY "Admins remove members" ON public.org_members FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;

-- SNAG PROJECTS
CREATE TABLE public.snag_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  site_address text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX snag_projects_org_idx ON public.snag_projects(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snag_projects TO authenticated;
GRANT ALL ON public.snag_projects TO service_role;
ALTER TABLE public.snag_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read snag projects" ON public.snag_projects FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Org members create snag projects" ON public.snag_projects FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Creator or admin update snag project" ON public.snag_projects FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Creator or admin delete snag project" ON public.snag_projects FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid());

-- SNAGS
CREATE TABLE public.snags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  snag_project_id uuid REFERENCES public.snag_projects(id) ON DELETE SET NULL,
  photo_path text NOT NULL,
  defect_title text NOT NULL,
  description text,
  cause text,
  rectification_option_a text,
  rectification_option_b text,
  tradesman_hack text,
  regulatory_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  hs_notes text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  trade text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed','disputed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX snags_org_idx ON public.snags(org_id);
CREATE INDEX snags_status_idx ON public.snags(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snags TO authenticated;
GRANT ALL ON public.snags TO service_role;
ALTER TABLE public.snags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read snags" ON public.snags FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Org members create snags" ON public.snags FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Creator or admin update snags" ON public.snags FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Creator or admin delete snags" ON public.snags FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id, auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER snags_updated_at BEFORE UPDATE ON public.snags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER snag_projects_updated_at BEFORE UPDATE ON public.snag_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER orgs_updated_at BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SNAG COMMENTS
CREATE TABLE public.snag_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snag_id uuid NOT NULL REFERENCES public.snags(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX snag_comments_snag_idx ON public.snag_comments(snag_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snag_comments TO authenticated;
GRANT ALL ON public.snag_comments TO service_role;
ALTER TABLE public.snag_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read comments" ON public.snag_comments FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Org members post comments" ON public.snag_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Author or admin deletes comment" ON public.snag_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(org_id, auth.uid()));

-- Seed 5 test orgs
INSERT INTO public.orgs (name, slug) VALUES
  ('Test Org 1', 'test-org-1'),
  ('Test Org 2', 'test-org-2'),
  ('Test Org 3', 'test-org-3'),
  ('Test Org 4', 'test-org-4'),
  ('Test Org 5', 'test-org-5')
ON CONFLICT (slug) DO NOTHING;

-- Storage policies on snag-photos bucket
CREATE POLICY "Snag photos: org members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'snag-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "Snag photos: org members upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'snag-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "Snag photos: org members delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'snag-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
