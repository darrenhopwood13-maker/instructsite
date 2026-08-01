CREATE OR REPLACE FUNCTION public.workface_approved_completion(_project_id uuid)
 RETURNS TABLE(workface_id uuid, pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.workface_id,
         LEAST(100::numeric, COALESCE(SUM(COALESCE(d.qs_verified_pct::numeric, d.manager_completion_pct::numeric, d.completion_pct::numeric)), 0::numeric))::numeric
    FROM public.daily_site_diaries d
   WHERE d.project_id = _project_id
     AND d.qs_status = 'approved'
     AND d.workface_id IS NOT NULL
     AND public.is_project_member(_project_id, auth.uid())
   GROUP BY d.workface_id;
$function$;

REVOKE ALL ON FUNCTION public.workface_approved_completion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workface_approved_completion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workface_approved_completion(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.zone_runtime_progress(_project_id uuid)
 RETURNS TABLE(zone_id uuid, progress_pct numeric, all_workfaces_complete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH allowed AS (
    SELECT public.is_project_member(_project_id, auth.uid()) AS ok
  ),
  zones AS (
    SELECT z.id FROM public.work_zones z
     WHERE z.project_id = _project_id AND (SELECT ok FROM allowed)
  ),
  wf AS (
    SELECT w.zone_id,
           w.id AS unit_id,
           LEAST(100::numeric, COALESCE((
             SELECT SUM(COALESCE(d.qs_verified_pct::numeric, d.manager_completion_pct::numeric, d.completion_pct::numeric))
               FROM public.daily_site_diaries d
              WHERE d.workface_id = w.id AND d.qs_status = 'approved'
           ), 0::numeric))::numeric AS pct,
           true AS is_workface
      FROM public.workfaces w
     WHERE w.project_id = _project_id
       AND w.status = 'confirmed'
       AND w.zone_id IS NOT NULL
  ),
  loose AS (
    SELECT d.zone_id,
           d.zone_id AS unit_id,
           LEAST(100::numeric, COALESCE(SUM(COALESCE(d.qs_verified_pct::numeric, d.manager_completion_pct::numeric, d.completion_pct::numeric)), 0::numeric))::numeric AS pct,
           false AS is_workface
      FROM public.daily_site_diaries d
     WHERE d.project_id = _project_id
       AND d.qs_status = 'approved'
       AND d.zone_id IS NOT NULL
       AND d.workface_id IS NULL
     GROUP BY d.zone_id
  ),
  units AS (
    SELECT * FROM wf
    UNION ALL
    SELECT * FROM loose
  )
  SELECT z.id,
         COALESCE(ROUND(AVG(u.pct), 2), 0)::numeric AS progress_pct,
         COALESCE(
           COUNT(*) FILTER (WHERE u.is_workface) > 0
           AND COUNT(*) FILTER (WHERE u.is_workface AND u.pct < 100) = 0,
           false
         ) AS all_workfaces_complete
    FROM zones z
    LEFT JOIN units u ON u.zone_id = z.id
   GROUP BY z.id;
$function$;

REVOKE ALL ON FUNCTION public.zone_runtime_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zone_runtime_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_runtime_progress(uuid) TO service_role;