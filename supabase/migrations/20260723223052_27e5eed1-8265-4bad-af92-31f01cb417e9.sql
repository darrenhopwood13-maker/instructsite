
-- 1) Require org_id on projects (safe: no rows exist yet)
ALTER TABLE public.projects ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);

-- 2) Rebuild SELECT policies to include org membership
DROP POLICY IF EXISTS "Members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Master admins can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Owner can view all projects" ON public.projects;

CREATE POLICY "Projects visible to org, project members, or master admin"
ON public.projects FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'master_admin')
  OR public.is_project_member(id, auth.uid())
  OR public.is_org_member(org_id, auth.uid())
  OR lower(COALESCE((auth.jwt() ->> 'email'), '')) = lower(COALESCE(current_setting('app.owner_email', true), 'darrenhopwood13@gmail.com'))
);

-- 3) INSERT: master admin OR org admin of the target org
DROP POLICY IF EXISTS "Master admins can create projects" ON public.projects;
CREATE POLICY "Master admins or org admins can create projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'master_admin')
    OR public.is_org_admin(org_id, auth.uid())
  )
);

-- 4) UPDATE / DELETE remain via existing helpers (project admin / master admin)
-- (Keep existing "Project admins can update projects" and "Master admins can delete projects" policies as-is.)
