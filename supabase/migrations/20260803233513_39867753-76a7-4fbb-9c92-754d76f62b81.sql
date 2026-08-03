-- =========================================================
-- SHORT-TERM PROGRAMMES
-- =========================================================

CREATE TABLE public.short_term_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_invite_id uuid NOT NULL REFERENCES public.subcontractor_invites(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  package_label text NOT NULL,
  title text NOT NULL,
  site_manager_user_id uuid,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_acceptance','accepted')),
  created_via text NOT NULL CHECK (created_via IN ('upload','ai_builder')),
  created_by uuid NOT NULL,
  site_manager_accepted_at timestamptz,
  site_manager_accepted_by uuid,
  subcontractor_accepted_at timestamptz,
  subcontractor_accepted_by uuid,
  site_document_id uuid REFERENCES public.site_documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stp_project ON public.short_term_programmes(project_id);
CREATE INDEX idx_stp_invite ON public.short_term_programmes(package_invite_id);

CREATE TABLE public.short_term_programme_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.short_term_programmes(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  local_ref text NOT NULL,
  task_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  predecessors text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','at_risk','done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stp_tasks_programme ON public.short_term_programme_tasks(programme_id);

CREATE TABLE public.short_term_programme_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.short_term_programmes(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.short_term_programme_tasks(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stp_notes_programme ON public.short_term_programme_annotations(programme_id);

-- =========================================================
-- ACTIVITY DESCRIPTION LIBRARY (two tier)
-- =========================================================

CREATE TABLE public.project_activity_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_pad_unique ON public.project_activity_descriptions(project_id, lower(label));

CREATE TABLE public.org_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_oat_unique ON public.org_activity_types(org_id, lower(label));

-- =========================================================
-- GRANTS
-- =========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_term_programmes TO authenticated;
GRANT ALL ON public.short_term_programmes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_term_programme_tasks TO authenticated;
GRANT ALL ON public.short_term_programme_tasks TO service_role;
GRANT SELECT, INSERT ON public.short_term_programme_annotations TO authenticated;
GRANT ALL ON public.short_term_programme_annotations TO service_role;
GRANT SELECT, INSERT ON public.project_activity_descriptions TO authenticated;
GRANT ALL ON public.project_activity_descriptions TO service_role;
GRANT SELECT, INSERT ON public.org_activity_types TO authenticated;
GRANT ALL ON public.org_activity_types TO service_role;

-- =========================================================
-- VISIBILITY HELPER
-- Project staff see everything on the project; a user who is on the project
-- as a subcontractor only ever sees their own company's programmes.
-- =========================================================

CREATE OR REPLACE FUNCTION public.stp_visible(_project_id uuid, _package_invite_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_member(_project_id, _user_id)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.subcontractor_invites si
         WHERE si.project_id = _project_id AND si.accepted_by = _user_id
      )
      OR EXISTS (
        SELECT 1
          FROM public.subcontractor_invites mine
          JOIN public.subcontractor_invites target ON target.id = _package_invite_id
         WHERE mine.project_id = _project_id
           AND mine.accepted_by = _user_id
           AND lower(mine.company_name) = lower(target.company_name)
      )
    )
$$;

-- Resolve which side of the table the caller sits on for a programme.
-- 'site_manager'    = project admin / master admin / project site manager
-- 'subcontractor_pm' = the accepted admin (PM) seat for that company
CREATE OR REPLACE FUNCTION public.stp_role_for(_programme_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.short_term_programmes;
BEGIN
  SELECT * INTO v_p FROM public.short_term_programmes WHERE id = _programme_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM public.subcontractor_invites si
     WHERE si.project_id = v_p.project_id
       AND si.revoked_at IS NULL
       AND si.seat_role = 'admin'
       AND si.accepted_by = _user_id
       AND lower(si.company_name) = lower(v_p.company_name)
  ) THEN
    RETURN 'subcontractor_pm';
  END IF;

  IF public.is_project_admin(v_p.project_id, _user_id)
     OR public.has_role(_user_id, 'master_admin')
     OR EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = v_p.project_id
          AND pm.user_id = _user_id
          AND pm.role_on_project IN ('site_manager','project_admin','master_admin')
     )
  THEN
    RETURN 'site_manager';
  END IF;

  RETURN NULL;
END;
$$;

-- =========================================================
-- RLS
-- =========================================================

ALTER TABLE public.short_term_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_term_programme_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_term_programme_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stp read" ON public.short_term_programmes
  FOR SELECT TO authenticated
  USING (public.stp_visible(project_id, package_invite_id, auth.uid()));

CREATE POLICY "stp insert" ON public.short_term_programmes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.stp_visible(project_id, package_invite_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "stp update" ON public.short_term_programmes
  FOR UPDATE TO authenticated
  USING (public.stp_visible(project_id, package_invite_id, auth.uid()))
  WITH CHECK (public.stp_visible(project_id, package_invite_id, auth.uid()));

CREATE POLICY "stp delete drafts" ON public.short_term_programmes
  FOR DELETE TO authenticated
  USING (
    status <> 'accepted'
    AND public.stp_visible(project_id, package_invite_id, auth.uid())
  );

CREATE POLICY "stp tasks all" ON public.short_term_programme_tasks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.short_term_programmes p
     WHERE p.id = programme_id
       AND public.stp_visible(p.project_id, p.package_invite_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.short_term_programmes p
     WHERE p.id = programme_id
       AND public.stp_visible(p.project_id, p.package_invite_id, auth.uid())
  ));

CREATE POLICY "stp notes read" ON public.short_term_programme_annotations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.short_term_programmes p
     WHERE p.id = programme_id
       AND public.stp_visible(p.project_id, p.package_invite_id, auth.uid())
  ));

CREATE POLICY "stp notes append" ON public.short_term_programme_annotations
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.short_term_programmes p
       WHERE p.id = programme_id
         AND public.stp_visible(p.project_id, p.package_invite_id, auth.uid())
    )
  );

CREATE POLICY "pad read" ON public.project_activity_descriptions
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "pad insert" ON public.project_activity_descriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "oat read" ON public.org_activity_types
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "oat insert" ON public.org_activity_types
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- =========================================================
-- LOCK TRIGGERS (mirrors the permit close-out lock)
-- =========================================================

CREATE OR REPLACE FUNCTION public.stp_lock_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.short_term_programmes
   WHERE id = COALESCE(NEW.programme_id, OLD.programme_id);

  IF v_status IS DISTINCT FROM 'accepted' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'STP_LOCKED: this programme is accepted — tasks cannot be removed.';
  END IF;

  IF NEW.task_name IS DISTINCT FROM OLD.task_name
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.seq IS DISTINCT FROM OLD.seq
     OR NEW.local_ref IS DISTINCT FROM OLD.local_ref
     OR NEW.predecessors IS DISTINCT FROM OLD.predecessors THEN
    RAISE EXCEPTION 'STP_LOCKED: this programme is accepted — only the task status can change.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stp_lock_tasks
  BEFORE UPDATE OR DELETE ON public.short_term_programme_tasks
  FOR EACH ROW EXECUTE FUNCTION public.stp_lock_tasks();

CREATE OR REPLACE FUNCTION public.stp_lock_programme()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'accepted' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.package_label IS DISTINCT FROM OLD.package_label
       OR NEW.package_invite_id IS DISTINCT FROM OLD.package_invite_id THEN
      RAISE EXCEPTION 'STP_LOCKED: this programme is accepted and can no longer be changed.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stp_lock_programme
  BEFORE UPDATE ON public.short_term_programmes
  FOR EACH ROW EXECUTE FUNCTION public.stp_lock_programme();

CREATE TRIGGER trg_stp_tasks_updated
  BEFORE UPDATE ON public.short_term_programme_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- WORKFLOW RPCs
-- =========================================================

CREATE OR REPLACE FUNCTION public.send_short_term_programme_for_approval(_programme_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_tasks integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_role := public.stp_role_for(_programme_id, v_uid);
  IF v_role IS NULL THEN RAISE EXCEPTION 'You cannot act on this programme.'; END IF;

  SELECT status INTO v_status FROM public.short_term_programmes WHERE id = _programme_id;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft can be sent for approval.';
  END IF;

  SELECT count(*) INTO v_tasks FROM public.short_term_programme_tasks WHERE programme_id = _programme_id;
  IF v_tasks = 0 THEN
    RAISE EXCEPTION 'Add at least one task before sending for approval.';
  END IF;

  UPDATE public.short_term_programmes
     SET status = 'pending_acceptance'
   WHERE id = _programme_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_short_term_programme(_programme_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_p public.short_term_programmes;
  v_sm_ok boolean;
  v_sub_ok boolean;
  v_accepted integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_p FROM public.short_term_programmes WHERE id = _programme_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programme not found.'; END IF;
  IF v_p.status = 'draft' THEN
    RAISE EXCEPTION 'This programme has not been sent for approval yet.';
  END IF;
  IF v_p.status = 'accepted' THEN RETURN 'accepted'; END IF;

  v_role := public.stp_role_for(_programme_id, v_uid);
  IF v_role IS NULL THEN RAISE EXCEPTION 'You cannot accept this programme.'; END IF;

  -- The subcontractor side can only ever be signed by the company's accepted
  -- PM (admin) seat. No silent fallback to another user on the company.
  IF v_role = 'site_manager' AND NOT EXISTS (
    SELECT 1 FROM public.subcontractor_invites si
     WHERE si.project_id = v_p.project_id
       AND si.revoked_at IS NULL
       AND si.seat_role = 'admin'
       AND si.accepted_by IS NOT NULL
       AND lower(si.company_name) = lower(v_p.company_name)
  ) THEN
    RAISE EXCEPTION 'STP_NO_PM: % has no project manager seat accepted on this project yet, so they cannot counter-sign. Invite their PM on an admin seat first.', v_p.company_name;
  END IF;

  IF v_role = 'site_manager' THEN
    UPDATE public.short_term_programmes
       SET site_manager_accepted_at = now(), site_manager_accepted_by = v_uid
     WHERE id = _programme_id;
  ELSE
    UPDATE public.short_term_programmes
       SET subcontractor_accepted_at = now(), subcontractor_accepted_by = v_uid
     WHERE id = _programme_id;
  END IF;

  SELECT site_manager_accepted_at IS NOT NULL, subcontractor_accepted_at IS NOT NULL
    INTO v_sm_ok, v_sub_ok
    FROM public.short_term_programmes WHERE id = _programme_id;

  IF v_sm_ok AND v_sub_ok THEN
    -- Cap is checked here, at the moment of acceptance: 5 accepted per
    -- company per package. Drafts and pending rows never count.
    SELECT count(*) INTO v_accepted
      FROM public.short_term_programmes p
     WHERE p.project_id = v_p.project_id
       AND lower(p.company_name) = lower(v_p.company_name)
       AND lower(p.package_label) = lower(v_p.package_label)
       AND p.status = 'accepted';

    IF v_accepted >= 5 THEN
      RAISE EXCEPTION 'STP_CAP: % already has 5 accepted short-term programmes for %. Nothing further can be accepted for this package.', v_p.company_name, v_p.package_label;
    END IF;

    UPDATE public.short_term_programmes SET status = 'accepted' WHERE id = _programme_id;
    RETURN 'accepted';
  END IF;

  RETURN CASE WHEN v_sm_ok THEN 'awaiting_subcontractor' ELSE 'awaiting_site_manager' END;
END;
$$;

REVOKE ALL ON FUNCTION public.send_short_term_programme_for_approval(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_short_term_programme(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stp_role_for(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stp_visible(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_short_term_programme_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_short_term_programme(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stp_role_for(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stp_visible(uuid, uuid, uuid) TO authenticated;