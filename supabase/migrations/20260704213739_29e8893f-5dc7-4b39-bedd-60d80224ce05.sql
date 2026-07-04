
-- 1. Extend live_site_activity status to include 'archived'
ALTER TABLE public.live_site_activity DROP CONSTRAINT IF EXISTS live_site_activity_status_check;
ALTER TABLE public.live_site_activity ADD CONSTRAINT live_site_activity_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'closed'::text, 'archived'::text]));

-- 2. Create daily_site_diaries
CREATE TABLE public.daily_site_diaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  live_activity_id UUID REFERENCES public.live_site_activity(id) ON DELETE SET NULL,
  subcontractor_id UUID NOT NULL,
  drawing_id UUID REFERENCES public.project_drawings(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES public.work_zones(id) ON DELETE SET NULL,
  trade_package TEXT,
  operative_count INTEGER NOT NULL CHECK (operative_count > 0),
  start_time TIMESTAMPTZ NOT NULL,
  scheduled_finish TIMESTAMPTZ NOT NULL,
  checkout_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_logged NUMERIC(6,2) NOT NULL,
  progress_status TEXT NOT NULL CHECK (progress_status IN ('completed','partial','not_completed')),
  completion_pct INTEGER NOT NULL CHECK (completion_pct BETWEEN 0 AND 100),
  notes TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  qs_status TEXT NOT NULL DEFAULT 'pending' CHECK (qs_status IN ('pending','approved','rejected')),
  ifc_synced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diaries_project ON public.daily_site_diaries(project_id, checkout_time DESC);
CREATE INDEX idx_diaries_qs_status ON public.daily_site_diaries(project_id, qs_status);
CREATE INDEX idx_diaries_zone ON public.daily_site_diaries(zone_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_site_diaries TO authenticated;
GRANT ALL ON public.daily_site_diaries TO service_role;

ALTER TABLE public.daily_site_diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view diaries"
  ON public.daily_site_diaries FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members insert own diary"
  ON public.daily_site_diaries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(project_id, auth.uid())
    AND subcontractor_id = auth.uid()
  );

CREATE POLICY "Project admins update diaries"
  ON public.daily_site_diaries FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "Project admins delete diaries"
  ON public.daily_site_diaries FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER update_daily_site_diaries_updated_at
  BEFORE UPDATE ON public.daily_site_diaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_site_diaries;
