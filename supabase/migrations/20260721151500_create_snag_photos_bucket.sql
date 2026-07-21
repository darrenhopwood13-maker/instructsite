-- Create the snag-photos storage bucket if it doesn't already exist.
-- The previous migration (20260711010828) added RLS policies assuming this
-- bucket existed, but never created it. Without the bucket, photo uploads
-- return "400 Bad Request".

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'snag-photos',
  'snag-photos',
  false,                                  -- not public; served via signed URLs
  10485760,                               -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO NOTHING;
