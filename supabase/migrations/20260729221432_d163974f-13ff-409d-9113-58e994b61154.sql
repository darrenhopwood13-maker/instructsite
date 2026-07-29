-- 1. workfaces register
CREATE TABLE IF NOT EXISTS public.workfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.work_zones(id) ON DELETE SET NULL,
  package_invite_id uuid REFERENCES public.subcontractor_invites(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('auto','manual')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed','archived')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workfaces_project_idx ON public.workfaces(project_id);
CREATE INDEX IF NOT EXISTS workfaces_zone_idx ON public.workfaces(zone_id);
CREATE UNIQUE INDEX IF NOT EXISTS workfaces_unique_pair_idx
  ON public.workfaces(project_id, zone_id, package_invite_id)
  WHERE status <> 'archived' AND zone_id IS NOT NULL AND package_invite_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workfaces TO authenticated;
GRANT ALL ON public.workfaces TO service_role;

ALTER TABLE public.workfaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workfaces" ON public.workfaces
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Admins insert workfaces" ON public.workfaces
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "Admins update workfaces" ON public.workfaces
  FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "Admins delete workfaces" ON public.workfaces
  FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

DROP TRIGGER IF EXISTS update_workfaces_updated_at ON public.workfaces;
CREATE TRIGGER update_workfaces_updated_at
  BEFORE UPDATE ON public.workfaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. link live pins + diaries to workfaces
ALTER TABLE public.live_site_activity
  ADD COLUMN IF NOT EXISTS workface_id uuid REFERENCES public.workfaces(id) ON DELETE SET NULL;
ALTER TABLE public.daily_site_diaries
  ADD COLUMN IF NOT EXISTS workface_id uuid REFERENCES public.workfaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS diaries_workface_idx ON public.daily_site_diaries(workface_id);

-- 3. manager verification fields on diaries
ALTER TABLE public.daily_site_diaries
  ADD COLUMN IF NOT EXISTS manager_completion_pct integer,
  ADD COLUMN IF NOT EXISTS manager_notes text,
  ADD COLUMN IF NOT EXISTS manager_photo_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS inspected_by uuid,
  ADD COLUMN IF NOT EXISTS inspected_at timestamptz;

-- 4. package manager contact on invites
ALTER TABLE public.subcontractor_invites
  ADD COLUMN IF NOT EXISTS package_manager_id uuid;

-- 5. auto-suggestion pass: one workface per active zone x accepted package
CREATE OR REPLACE FUNCTION public.suggest_workfaces(_project_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_project_admin(_project_id, v_uid) THEN
    RAISE EXCEPTION 'Project admin role required.';
  END IF;

  FOR v_id IN
    INSERT INTO public.workfaces (project_id, zone_id, package_invite_id, name, source, status, created_by)
    SELECT _project_id, z.id, i.id,
           z.name || ' — ' || i.company_name,
           'auto', 'proposed', v_uid
      FROM public.work_zones z
      JOIN public.subcontractor_invites i
        ON i.project_id = _project_id
       AND i.revoked_at IS NULL
       AND i.accepted_at IS NOT NULL
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
$$;

REVOKE ALL ON FUNCTION public.suggest_workfaces(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_workfaces(uuid) TO authenticated, service_role;

-- 6. workface-scoped approved completion
CREATE OR REPLACE FUNCTION public.workface_approved_completion(_project_id uuid)
RETURNS TABLE(workface_id uuid, pct numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.workface_id,
         LEAST(100, COALESCE(SUM(d.completion_pct), 0))::numeric
    FROM public.daily_site_diaries d
   WHERE d.project_id = _project_id
     AND d.qs_status = 'approved'
     AND d.workface_id IS NOT NULL
     AND public.is_project_member(_project_id, auth.uid())
   GROUP BY d.workface_id;
$$;

REVOKE ALL ON FUNCTION public.workface_approved_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workface_approved_completion(uuid) TO authenticated, service_role;

-- 7. real zone progress: workface-scoped, no double counting
CREATE OR REPLACE FUNCTION public.zone_runtime_progress(_project_id uuid)
RETURNS TABLE(zone_id uuid, progress_pct numeric, all_workfaces_complete boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.is_project_member(_project_id, auth.uid()) AS ok
  ),
  zones AS (
    SELECT z.id FROM public.work_zones z
     WHERE z.project_id = _project_id AND (SELECT ok FROM allowed)
  ),
  -- one unit per confirmed workface, capped at 100
  wf AS (
    SELECT w.zone_id,
           w.id AS unit_id,
           LEAST(100, COALESCE((
             SELECT SUM(d.completion_pct)
               FROM public.daily_site_diaries d
              WHERE d.workface_id = w.id AND d.qs_status = 'approved'
           ), 0))::numeric AS pct,
           true AS is_workface
      FROM public.workfaces w
     WHERE w.project_id = _project_id
       AND w.status = 'confirmed'
       AND w.zone_id IS NOT NULL
  ),
  -- diaries booked to a zone but not to any workface form one extra unit
  loose AS (
    SELECT d.zone_id,
           d.zone_id AS unit_id,
           LEAST(100, SUM(d.completion_pct))::numeric AS pct,
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
$$;

REVOKE ALL ON FUNCTION public.zone_runtime_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zone_runtime_progress(uuid) TO authenticated, service_role;