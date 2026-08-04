CREATE OR REPLACE FUNCTION public.is_project_admin(_project_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'master_admin') OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (p.master_admin_id = _user_id OR p.project_admin_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
      AND pm.role_on_project IN ('project_admin','master_admin')
  );
$function$;