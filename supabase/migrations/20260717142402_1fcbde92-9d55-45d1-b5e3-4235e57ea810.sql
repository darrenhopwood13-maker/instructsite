
-- Drop previous strict policies
DROP POLICY IF EXISTS "Members view subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Admins insert subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Admins update subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Admins delete subcontractors" ON public.subcontractors;

DROP POLICY IF EXISTS "Members view workers" ON public.workers;
DROP POLICY IF EXISTS "Admins insert workers" ON public.workers;
DROP POLICY IF EXISTS "Admins update workers" ON public.workers;
DROP POLICY IF EXISTS "Admins delete workers" ON public.workers;

DROP POLICY IF EXISTS "Members view registers" ON public.registers;
DROP POLICY IF EXISTS "Admins insert registers" ON public.registers;
DROP POLICY IF EXISTS "Admins update registers" ON public.registers;
DROP POLICY IF EXISTS "Admins delete registers" ON public.registers;

DROP POLICY IF EXISTS "Members view toolbox_talks" ON public.toolbox_talks;
DROP POLICY IF EXISTS "Admins insert toolbox_talks" ON public.toolbox_talks;
DROP POLICY IF EXISTS "Admins update toolbox_talks" ON public.toolbox_talks;
DROP POLICY IF EXISTS "Admins delete toolbox_talks" ON public.toolbox_talks;

DROP POLICY IF EXISTS "Members view look_aheads" ON public.look_aheads;
DROP POLICY IF EXISTS "Admins insert look_aheads" ON public.look_aheads;
DROP POLICY IF EXISTS "Admins update look_aheads" ON public.look_aheads;
DROP POLICY IF EXISTS "Admins delete look_aheads" ON public.look_aheads;

-- Helper (child tables)
CREATE OR REPLACE FUNCTION public.get_subcontractor_project_id(sub_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT project_id FROM public.subcontractors WHERE id = sub_id $$;

-- Simplified policies: project member OR founder
CREATE POLICY "Subcontractor access" ON public.subcontractors
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com')
  WITH CHECK (public.is_project_member(project_id, auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com');

CREATE POLICY "Compliance records access" ON public.workers
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com')
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com');

CREATE POLICY "Compliance records access" ON public.registers
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com')
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com');

CREATE POLICY "Compliance records access" ON public.toolbox_talks
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com')
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com');

CREATE POLICY "Compliance records access" ON public.look_aheads
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com')
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR auth.email() = 'darrenhopwood13@gmail.com');
