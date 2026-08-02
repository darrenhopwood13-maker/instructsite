ALTER TABLE public.programme_reference_tasks
  ADD COLUMN IF NOT EXISTS task_ref text,
  ADD COLUMN IF NOT EXISTS predecessors text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS duration_days integer;

CREATE INDEX IF NOT EXISTS programme_reference_tasks_upload_ref_idx
  ON public.programme_reference_tasks (programme_upload_id, task_ref);

ALTER TABLE public.programme_uploads
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;