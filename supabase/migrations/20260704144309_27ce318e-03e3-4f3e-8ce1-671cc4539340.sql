
CREATE TABLE public.live_site_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_id uuid REFERENCES public.project_drawings(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES public.work_zones(id) ON DELETE SET NULL,
  subcontractor_id uuid NOT NULL,
  trade_package text,
  operative_count integer NOT NULL DEFAULT 1 CHECK (operative_count > 0),
  start_time timestamptz NOT NULL DEFAULT now(),
  scheduled_finish timestamptz NOT NULL,
  x_pct numeric(6,4) NOT NULL CHECK (x_pct >= 0 AND x_pct <= 1),
  y_pct numeric(6,4) NOT NULL CHECK (y_pct >= 0 AND y_pct <= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_activity_project ON public.live_site_activity(project_id, status);
CREATE INDEX idx_live_activity_drawing ON public.live_site_activity(drawing_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_site_activity TO authenticated;
GRANT ALL ON public.live_site_activity TO service_role;

ALTER TABLE public.live_site_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view live activity"
  ON public.live_site_activity FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members insert own pins"
  ON public.live_site_activity FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND subcontractor_id = auth.uid());

CREATE POLICY "Subcontractor updates own pins"
  ON public.live_site_activity FOR UPDATE TO authenticated
  USING (subcontractor_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (subcontractor_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "Project admins delete pins"
  ON public.live_site_activity FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER trg_live_activity_updated_at
  BEFORE UPDATE ON public.live_site_activity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_site_activity;
ALTER TABLE public.live_site_activity REPLICA IDENTITY FULL;
