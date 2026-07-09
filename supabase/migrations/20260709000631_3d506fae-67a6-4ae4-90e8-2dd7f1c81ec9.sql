
CREATE TABLE public.programme_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES public.programme_uploads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','parsing','writing','complete','failed')),
  strategy text,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  stage text,
  error text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.programme_jobs TO authenticated;
GRANT ALL ON public.programme_jobs TO service_role;

ALTER TABLE public.programme_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view programme jobs"
  ON public.programme_jobs FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER programme_jobs_updated_at
  BEFORE UPDATE ON public.programme_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX programme_jobs_project_created_idx
  ON public.programme_jobs (project_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.programme_jobs;
