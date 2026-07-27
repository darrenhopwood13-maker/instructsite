
-- B1: site_documents lifecycle
ALTER TABLE public.site_documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.site_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_of uuid REFERENCES public.site_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS site_documents_project_hash_idx
  ON public.site_documents (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS site_documents_active_idx
  ON public.site_documents (created_at DESC)
  WHERE archived_at IS NULL;

-- B3: Full-text search over document_contents
CREATE INDEX IF NOT EXISTS document_contents_content_tsv_idx
  ON public.document_contents
  USING GIN (to_tsvector('english', content));
