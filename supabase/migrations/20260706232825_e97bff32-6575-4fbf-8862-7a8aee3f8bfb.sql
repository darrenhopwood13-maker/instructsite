
-- 1. programme_uploads
CREATE TABLE public.programme_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  task_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_uploads TO authenticated;
GRANT ALL ON public.programme_uploads TO service_role;
ALTER TABLE public.programme_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view programme_uploads" ON public.programme_uploads
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "admins manage programme_uploads" ON public.programme_uploads
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));
CREATE INDEX programme_uploads_project_idx ON public.programme_uploads(project_id, created_at DESC);

-- 2. programme_reference_tasks
CREATE TABLE public.programme_reference_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_upload_id uuid NOT NULL REFERENCES public.programme_uploads(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  plain_english text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  allowed_days integer GENERATED ALWAYS AS (GREATEST(1, (end_date - start_date) + 1)) STORED,
  location text,
  trade text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_reference_tasks TO authenticated;
GRANT ALL ON public.programme_reference_tasks TO service_role;
ALTER TABLE public.programme_reference_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view programme_tasks" ON public.programme_reference_tasks
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "admins manage programme_tasks" ON public.programme_reference_tasks
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));
CREATE INDEX programme_tasks_project_dates_idx ON public.programme_reference_tasks(project_id, start_date, end_date);

-- 3. programme_manager_notes
CREATE TABLE public.programme_manager_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_manager_notes TO authenticated;
GRANT ALL ON public.programme_manager_notes TO service_role;
ALTER TABLE public.programme_manager_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view manager_notes" ON public.programme_manager_notes
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members insert manager_notes" ON public.programme_manager_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "authors update own manager_notes" ON public.programme_manager_notes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "authors or admins delete manager_notes" ON public.programme_manager_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()));
CREATE INDEX manager_notes_project_date_idx ON public.programme_manager_notes(project_id, note_date DESC);
CREATE TRIGGER manager_notes_updated_at BEFORE UPDATE ON public.programme_manager_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.programme_manager_notes;
