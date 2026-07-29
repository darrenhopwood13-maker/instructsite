-- diary amendments audit trail
CREATE TABLE IF NOT EXISTS public.diary_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id uuid NOT NULL REFERENCES public.daily_site_diaries(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reason text NOT NULL,
  previous_manager_completion_pct integer,
  new_manager_completion_pct integer,
  previous_qs_status text,
  new_qs_status text,
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS diary_amendments_diary_idx ON public.diary_amendments(diary_id);

GRANT SELECT ON public.diary_amendments TO authenticated;
GRANT ALL ON public.diary_amendments TO service_role;

ALTER TABLE public.diary_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view diary amendments" ON public.diary_amendments
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

-- manager authorisation of a diary
CREATE OR REPLACE FUNCTION public.manager_authorise_diary(
  _diary_id uuid,
  _manager_completion_pct integer,
  _manager_notes text DEFAULT NULL,
  _manager_photo_urls text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT project_id INTO v_project FROM public.daily_site_diaries WHERE id = _diary_id;
  IF v_project IS NULL THEN RAISE EXCEPTION 'Diary not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
    OR public.is_project_admin(v_project, v_uid)
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager role required';
  END IF;

  UPDATE public.daily_site_diaries
     SET manager_completion_pct = LEAST(100, GREATEST(0, _manager_completion_pct)),
         manager_notes = NULLIF(_manager_notes, ''),
         manager_photo_urls = COALESCE(_manager_photo_urls, ARRAY[]::text[]),
         inspected_by = v_uid,
         inspected_at = now(),
         qs_status = 'approved',
         qs_rejection_reason = NULL,
         qs_remeasure_required = false
   WHERE id = _diary_id;
END;
$$;

REVOKE ALL ON FUNCTION public.manager_authorise_diary(uuid, integer, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_authorise_diary(uuid, integer, text, text[]) TO authenticated, service_role;

-- amend an approved diary (always audited)
CREATE OR REPLACE FUNCTION public.amend_approved_diary(
  _diary_id uuid,
  _new_manager_completion_pct integer,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_d public.daily_site_diaries;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT * INTO v_d FROM public.daily_site_diaries WHERE id = _diary_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Diary not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'master_admin')
    OR public.has_role(v_uid, 'project_admin')
    OR public.has_role(v_uid, 'site_manager')
    OR public.is_project_admin(v_d.project_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager role required';
  END IF;

  INSERT INTO public.diary_amendments (
    diary_id, project_id, reason,
    previous_manager_completion_pct, new_manager_completion_pct,
    previous_qs_status, new_qs_status, changed_by
  ) VALUES (
    _diary_id, v_d.project_id, btrim(_reason),
    v_d.manager_completion_pct, LEAST(100, GREATEST(0, _new_manager_completion_pct)),
    v_d.qs_status, 'approved', v_uid
  ) RETURNING id INTO v_id;

  UPDATE public.daily_site_diaries
     SET manager_completion_pct = LEAST(100, GREATEST(0, _new_manager_completion_pct)),
         qs_status = 'approved',
         inspected_by = v_uid,
         inspected_at = now()
   WHERE id = _diary_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.amend_approved_diary(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.amend_approved_diary(uuid, integer, text) TO authenticated, service_role;

-- site manager assignment helpers
CREATE OR REPLACE FUNCTION public.list_project_site_managers(_project_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.user_id, p.full_name
    FROM public.project_members pm
    LEFT JOIN public.profiles p ON p.user_id = pm.user_id
   WHERE pm.project_id = _project_id
     AND pm.role_on_project = 'site_manager'
     AND public.is_project_member(_project_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.list_unassigned_site_managers(_project_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, p.full_name
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.user_id = ur.user_id
   WHERE ur.role = 'site_manager'
     AND public.is_project_admin(_project_id, auth.uid())
     AND NOT EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = _project_id AND pm.user_id = ur.user_id
     );
$$;

CREATE OR REPLACE FUNCTION public.add_site_manager_to_project(_project_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_project_admin(_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Project admin role required.';
  END IF;
  INSERT INTO public.project_members (project_id, user_id, role_on_project)
  VALUES (_project_id, _user_id, 'site_manager')
  ON CONFLICT (project_id, user_id) DO UPDATE SET role_on_project = 'site_manager';
END;
$$;

REVOKE ALL ON FUNCTION public.list_project_site_managers(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_unassigned_site_managers(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_site_manager_to_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_site_managers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_unassigned_site_managers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_site_manager_to_project(uuid, uuid) TO authenticated, service_role;