
-- 1. Compliance docs bucket: verify project ownership via path
DROP POLICY IF EXISTS "Auth users read compliance-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users write compliance-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update compliance-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete compliance-docs" ON storage.objects;

-- Path is: {userId}/{projectId}/{subfolder}/{filename}
CREATE POLICY "Project members read compliance-docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND public.is_project_member(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "Project members write own compliance-docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_project_member(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "Owners or admins update compliance-docs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_project_admin(((storage.foldername(name))[2])::uuid, auth.uid())
  )
);

CREATE POLICY "Owners or admins delete compliance-docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_project_admin(((storage.foldername(name))[2])::uuid, auth.uid())
  )
);

-- 2. Lock down SECURITY DEFINER functions
-- Revoke anon (public) execute on all; revoke authenticated where not needed.

-- Privileged / internal — no client role should call these
REVOKE ALL ON FUNCTION public.dev_claim_master_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_first_master_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_subcontractor_seat_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_org_member_caps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_flag_permit_required() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_pin_high_risk() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_zone_ifc_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- RPCs called by the app — keep authenticated, drop anon
REVOKE ALL ON FUNCTION public.manager_force_checkout(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_force_checkout(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_pin_permit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_pin_permit(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_org_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_subcontractor_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_subcontractor_invite(text) TO authenticated;

-- RLS helper functions — used inside policies, keep authenticated, drop anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_project_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_admin(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.org_admin_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_admin_count(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_feature(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_feature(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.subcontractor_project_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subcontractor_project_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_subcontractor_project_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_subcontractor_project_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.site_document_project_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_document_project_ids(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_view_site_document(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_site_document(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_admin_site_document(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_site_document(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.zone_approved_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zone_approved_completion(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.subcontractor_seat_usage(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subcontractor_seat_usage(uuid, text) TO authenticated;
