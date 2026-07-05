
CREATE OR REPLACE FUNCTION public.dev_claim_master_admin(_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid := _project_id;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'master_admin')
  ON CONFLICT DO NOTHING;

  IF v_project IS NULL THEN
    SELECT id INTO v_project FROM public.projects
    WHERE name ILIKE '%stanley%' LIMIT 1;
  END IF;

  IF v_project IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, role_on_project)
    VALUES (v_project, v_uid, 'project_admin')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role_on_project = 'project_admin';

    UPDATE public.projects
       SET master_admin_id = COALESCE(master_admin_id, v_uid),
           project_admin_id = COALESCE(project_admin_id, v_uid)
     WHERE id = v_project;
  END IF;

  RETURN jsonb_build_object('user_id', v_uid, 'project_id', v_project, 'role', 'master_admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_claim_master_admin(uuid) TO authenticated;
