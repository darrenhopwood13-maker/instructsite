
ALTER TABLE public.subcontractor_invites
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS office_phone text,
  ADD COLUMN IF NOT EXISTS corporate_email text,
  ADD COLUMN IF NOT EXISTS pm_name text,
  ADD COLUMN IF NOT EXISTS pm_mobile text,
  ADD COLUMN IF NOT EXISTS pm_email text,
  ADD COLUMN IF NOT EXISTS supervisor_name text,
  ADD COLUMN IF NOT EXISTS supervisor_mobile text,
  ADD COLUMN IF NOT EXISTS supervisor_email text;
