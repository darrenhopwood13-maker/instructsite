
CREATE TABLE public.daily_programme_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  programme_upload_id UUID REFERENCES public.programme_uploads(id) ON DELETE CASCADE,
  playbook_date DATE NOT NULL,
  ai_daily_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, playbook_date)
);

CREATE INDEX daily_playbooks_project_date_idx
  ON public.daily_programme_playbooks (project_id, playbook_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_programme_playbooks TO authenticated;
GRANT ALL ON public.daily_programme_playbooks TO service_role;

ALTER TABLE public.daily_programme_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view daily_playbooks"
  ON public.daily_programme_playbooks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "admins manage daily_playbooks"
  ON public.daily_programme_playbooks FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER daily_playbooks_updated_at
  BEFORE UPDATE ON public.daily_programme_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_programme_playbooks;
