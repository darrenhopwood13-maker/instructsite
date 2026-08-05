ALTER TABLE public.live_site_activity ADD COLUMN IF NOT EXISTS programme_task_ref text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS programme_task_ref text;
ALTER TABLE public.daily_site_diaries ADD COLUMN IF NOT EXISTS programme_task_ref text;
CREATE INDEX IF NOT EXISTS live_site_activity_programme_task_ref_idx ON public.live_site_activity (project_id, programme_task_ref);
CREATE INDEX IF NOT EXISTS daily_site_diaries_programme_task_ref_idx ON public.daily_site_diaries (project_id, programme_task_ref);