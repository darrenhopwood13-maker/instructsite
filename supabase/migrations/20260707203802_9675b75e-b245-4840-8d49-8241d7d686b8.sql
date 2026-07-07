
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_number text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE TABLE IF NOT EXISTS public.project_weather_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'open-meteo',
  temperature_c numeric,
  apparent_c numeric,
  wind_kph numeric,
  humidity_pct numeric,
  precip_mm numeric,
  weather_code integer,
  summary text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.project_weather_readings TO authenticated;
GRANT ALL ON public.project_weather_readings TO service_role;

ALTER TABLE public.project_weather_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view weather readings"
  ON public.project_weather_readings FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can insert weather readings"
  ON public.project_weather_readings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_weather_project_captured
  ON public.project_weather_readings (project_id, captured_at DESC);
