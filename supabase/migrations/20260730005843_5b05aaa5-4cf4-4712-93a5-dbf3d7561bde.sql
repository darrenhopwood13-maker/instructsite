CREATE OR REPLACE FUNCTION public.suggest_workfaces(_project_id uuid)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_project_admin(_project_id, v_uid) THEN
    RAISE EXCEPTION 'Project admin role required.';
  END IF;

  FOR v_id IN
    INSERT INTO public.workfaces (project_id, zone_id, package_invite_id, name, stage, source, status, created_by)
    SELECT _project_id, z.id, i.id,
           z.name || ' — ' || i.company_name,
           NULLIF(i.trade_packages[1], ''),
           'auto', 'proposed', v_uid
      FROM public.work_zones z
      JOIN public.subcontractor_invites i
        ON i.project_id = _project_id
       AND i.revoked_at IS NULL
     WHERE z.project_id = _project_id
       AND z.status <> 'archived'
       AND NOT EXISTS (
         SELECT 1 FROM public.workfaces w
          WHERE w.project_id = _project_id
            AND w.zone_id = z.id
            AND w.package_invite_id = i.id
            AND w.status <> 'archived'
       )
    RETURNING id
  LOOP
    RETURN NEXT v_id;
  END LOOP;
END;
$function$;