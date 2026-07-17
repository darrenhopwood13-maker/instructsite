
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS notes text;

DROP POLICY IF EXISTS "Owner can view all orgs" ON public.orgs;
CREATE POLICY "Owner can view all orgs" ON public.orgs
  FOR SELECT TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'darrenhopwood13@gmail.com');

DROP POLICY IF EXISTS "Owner can update all orgs" ON public.orgs;
CREATE POLICY "Owner can update all orgs" ON public.orgs
  FOR UPDATE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'darrenhopwood13@gmail.com')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'darrenhopwood13@gmail.com');

DROP POLICY IF EXISTS "Owner can view all org_members" ON public.org_members;
CREATE POLICY "Owner can view all org_members" ON public.org_members
  FOR SELECT TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'darrenhopwood13@gmail.com');

DROP POLICY IF EXISTS "Owner can view all projects" ON public.projects;
CREATE POLICY "Owner can view all projects" ON public.projects
  FOR SELECT TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'darrenhopwood13@gmail.com');
