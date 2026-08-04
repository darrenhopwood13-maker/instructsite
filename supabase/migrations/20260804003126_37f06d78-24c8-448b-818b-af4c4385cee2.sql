CREATE TABLE public.private_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  packages text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX private_programmes_owner_idx ON public.private_programmes(owner_user_id, project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_programmes TO authenticated;
GRANT ALL ON public.private_programmes TO service_role;

ALTER TABLE public.private_programmes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own private programmes read" ON public.private_programmes
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "own private programmes insert" ON public.private_programmes
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.is_project_member(project_id, auth.uid()));
CREATE POLICY "own private programmes update" ON public.private_programmes
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "own private programmes delete" ON public.private_programmes
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE TRIGGER private_programmes_updated_at
  BEFORE UPDATE ON public.private_programmes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.private_programme_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.private_programmes(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  local_ref text NOT NULL DEFAULT '1',
  task_name text NOT NULL,
  package_label text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','at_risk','done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX private_programme_tasks_programme_idx ON public.private_programme_tasks(programme_id, seq);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_programme_tasks TO authenticated;
GRANT ALL ON public.private_programme_tasks TO service_role;

ALTER TABLE public.private_programme_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own private tasks all" ON public.private_programme_tasks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.private_programmes p
     WHERE p.id = private_programme_tasks.programme_id AND p.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.private_programmes p
     WHERE p.id = private_programme_tasks.programme_id AND p.owner_user_id = auth.uid()));

CREATE TRIGGER private_programme_tasks_updated_at
  BEFORE UPDATE ON public.private_programme_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();