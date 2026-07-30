ALTER TABLE public.work_zones
  ADD COLUMN IF NOT EXISTS logistics_plan_id uuid REFERENCES public.logistics_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS work_zones_logistics_plan_id_idx ON public.work_zones (logistics_plan_id);

ALTER TABLE public.logistics_plans
  ADD COLUMN IF NOT EXISTS extraction_started_at timestamptz;

CREATE INDEX IF NOT EXISTS project_drawings_dedupe_idx
  ON public.project_drawings (project_id, drawing_no, revision, page_number);