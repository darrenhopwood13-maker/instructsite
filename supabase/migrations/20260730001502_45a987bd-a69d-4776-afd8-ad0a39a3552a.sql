ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS card_expiry date;

ALTER TABLE public.registers
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS next_inspection_due date,
  ADD COLUMN IF NOT EXISTS inspector text;

ALTER TABLE public.toolbox_talks
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS presenter text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS attachment_url text;

ALTER TABLE public.look_aheads
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

CREATE INDEX IF NOT EXISTS workers_recorded_by_idx ON public.workers (recorded_by);
CREATE INDEX IF NOT EXISTS registers_recorded_by_idx ON public.registers (recorded_by);
CREATE INDEX IF NOT EXISTS toolbox_talks_recorded_by_idx ON public.toolbox_talks (recorded_by);
CREATE INDEX IF NOT EXISTS look_aheads_recorded_by_idx ON public.look_aheads (recorded_by);