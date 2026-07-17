-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_to TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- project_bible_reports
CREATE TABLE public.project_bible_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_document_id UUID NOT NULL REFERENCES public.site_documents(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  source TEXT,
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_bible_reports TO authenticated;
GRANT ALL ON public.project_bible_reports TO service_role;
ALTER TABLE public.project_bible_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view project bible reports" ON public.project_bible_reports
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members insert project bible reports" ON public.project_bible_reports
  FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Admins or creator delete project bible reports" ON public.project_bible_reports
  FOR DELETE TO authenticated USING (public.is_project_admin(project_id, auth.uid()) OR created_by = auth.uid());
CREATE INDEX idx_bible_reports_project ON public.project_bible_reports(project_id, created_at DESC);
CREATE TRIGGER project_bible_reports_updated_at
  BEFORE UPDATE ON public.project_bible_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();