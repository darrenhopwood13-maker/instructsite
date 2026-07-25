
-- 1. Remove hardcoded email backdoors, replace with master_admin role check

-- orgs
DROP POLICY IF EXISTS "Owner can view all orgs" ON public.orgs;
DROP POLICY IF EXISTS "Owner can update all orgs" ON public.orgs;
CREATE POLICY "Master admin can view all orgs" ON public.orgs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'));
CREATE POLICY "Master admin can update all orgs" ON public.orgs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

-- org_members
DROP POLICY IF EXISTS "Owner can view all org_members" ON public.org_members;
CREATE POLICY "Master admin can view all org_members" ON public.org_members
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin'));

-- org_invites
DROP POLICY IF EXISTS "Founder or org admins manage invites" ON public.org_invites;
DROP POLICY IF EXISTS "Founder or org admins view invites" ON public.org_invites;
CREATE POLICY "Master admin or org admins manage invites" ON public.org_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin') OR public.is_org_admin(org_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin') OR public.is_org_admin(org_id, auth.uid()));
CREATE POLICY "Master admin or org admins view invites" ON public.org_invites
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin') OR public.is_org_admin(org_id, auth.uid()));

-- subcontractors
DROP POLICY IF EXISTS "Subcontractor access" ON public.subcontractors;
CREATE POLICY "Subcontractor access" ON public.subcontractors
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()) OR public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.is_project_member(project_id, auth.uid()) OR public.has_role(auth.uid(), 'master_admin'));

-- workers / registers / toolbox_talks / look_aheads
DROP POLICY IF EXISTS "Compliance records access" ON public.workers;
CREATE POLICY "Compliance records access" ON public.workers
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'));

DROP POLICY IF EXISTS "Compliance records access" ON public.registers;
CREATE POLICY "Compliance records access" ON public.registers
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'));

DROP POLICY IF EXISTS "Compliance records access" ON public.toolbox_talks;
CREATE POLICY "Compliance records access" ON public.toolbox_talks
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'));

DROP POLICY IF EXISTS "Compliance records access" ON public.look_aheads;
CREATE POLICY "Compliance records access" ON public.look_aheads
  FOR ALL TO authenticated
  USING (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'))
  WITH CHECK (public.is_project_member(public.get_subcontractor_project_id(subcontractor_id), auth.uid()) OR public.has_role(auth.uid(), 'master_admin'));

-- projects: drop app.owner_email fallback
DROP POLICY IF EXISTS "Projects visible to org, project members, or master admin" ON public.projects;
CREATE POLICY "Projects visible to org, project members, or master admin" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'master_admin')
    OR public.is_project_member(id, auth.uid())
    OR public.is_org_member(org_id, auth.uid())
  );

-- 2. org_members self-admin bootstrap: only org creator can self-claim
DROP POLICY IF EXISTS "Admins or self-claim add members" ON public.org_members;
CREATE POLICY "Admins or org creator bootstrap add members" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(org_id, auth.uid())
    OR (
      user_id = auth.uid()
      AND role = 'admin'
      AND public.org_admin_count(org_id) = 0
      AND EXISTS (SELECT 1 FROM public.orgs o WHERE o.id = org_id AND o.created_by = auth.uid())
    )
  );

-- 3. Project Bible storage: allow project members to view via site_documents
DROP POLICY IF EXISTS "Users can read their own Project Bible files" ON storage.objects;
CREATE POLICY "Project members can read Project Bible files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-bible'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.site_documents sd
        WHERE sd.bucket = 'project-bible'
          AND sd.file_path = storage.objects.name
          AND public.can_view_site_document(sd.id, auth.uid())
      )
    )
  );

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers from signed-in users
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.dev_claim_master_admin(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_master_admin() FROM PUBLIC, authenticated, anon;

-- 5. Set search_path on functions missing it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
