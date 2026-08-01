ALTER TABLE public.daily_site_diaries
  ADD COLUMN IF NOT EXISTS qs_verified_pct numeric,
  ADD COLUMN IF NOT EXISTS qs_notes text;