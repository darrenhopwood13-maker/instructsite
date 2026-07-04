ALTER TABLE public.project_drawings
  ADD COLUMN IF NOT EXISTS page_number integer,
  ADD COLUMN IF NOT EXISTS pack_id uuid,
  ADD COLUMN IF NOT EXISTS pack_name text;

CREATE INDEX IF NOT EXISTS project_drawings_pack_id_idx ON public.project_drawings(pack_id);