-- =========================================================
-- PACKAGE MANAGER ASSIGNMENT
-- Each subcontractor "package" (a subcontractor_invites row — company +
-- trade packages on a project) can be assigned to exactly one Site Manager,
-- who becomes its Package Manager. A project can have many Site Managers,
-- each owning a different subset of packages. This is the foundation for
-- the personal Site Manager diary, which will only show activity for
-- packages the viewing manager is assigned to.
-- =========================================================

ALTER TABLE public.subcontractor_invites
  ADD COLUMN package_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_subcontractor_invites_package_manager
  ON public.subcontractor_invites(package_manager_id);

-- Security-definer helper (mirrors is_project_admin / is_project_member style)
CREATE OR REPLACE FUNCTION public.is_package_manager(_invite_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subcontractor_invites si
    WHERE si.id = _invite_id AND si.package_manager_id = _user_id
  );
$$;

-- Site Managers need to see the packages assigned to them, in addition to
-- the existing "Project admins manage invites" ALL policy (which already
-- covers master_admin and project_admin via is_project_admin).
CREATE POLICY "Package managers view their assigned packages"
  ON public.subcontractor_invites FOR SELECT
  TO authenticated
  USING (package_manager_id = auth.uid());

-- NOTE: there was previously no path in the app that ever added a Site
-- Manager to project_members with role_on_project = 'site_manager' — that
-- value has never been written anywhere. Project Admins get added
-- automatically on project creation; Site Managers never did, on any
-- project. add_site_manager_to_project() below is the fix: it lets a
-- Project Admin add an existing global Site Manager to their project,
-- which is a prerequisite for Package Manager assignment to mean anything.
CREATE OR REPLACE FUNCTION public.add_site_manager_to_project(_project_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_project_admin(_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Project admin role required.';
  END IF;
  IF NOT public.has_role(_user_id, 'site_manager') THEN
    RAISE EXCEPTION 'Target user does not hold the site_manager role.';
  END IF;
  INSERT INTO public.project_members (project_id, user_id, role_on_project)
  VALUES (_project_id, _user_id, 'site_manager')
  ON CONFLICT (project_id, user_id, role_on_project) DO NOTHING;
END;
$$;

-- Lists Site Managers already added to this project — the real eligible
-- pool for Package Manager assignment now that add_site_manager_to_project
-- exists to populate it.
CREATE OR REPLACE FUNCTION public.list_project_site_managers(_project_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT pm.user_id, p.full_name
  FROM public.project_members pm
  LEFT JOIN public.profiles p ON p.user_id = pm.user_id
  WHERE pm.project_id = _project_id
    AND pm.role_on_project = 'site_manager';
$$;

-- Lists Site Managers who hold the global role but are not yet added to
-- this project — the candidate pool for add_site_manager_to_project.
CREATE OR REPLACE FUNCTION public.list_unassigned_site_managers(_project_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ur.user_id, p.full_name
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'site_manager'
    AND NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = _project_id
        AND pm.user_id = ur.user_id
        AND pm.role_on_project = 'site_manager'
    );
$$;
