CREATE TABLE IF NOT EXISTS public.site_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  file_size bigint,
  mime_type text,
  bucket text NOT NULL DEFAULT 'project-bible',
  uploaded_by uuid NOT NULL,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'complete', 'empty', 'failed')),
  extraction_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_documents TO authenticated;
GRANT ALL ON public.site_documents TO service_role;

ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.document_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.site_documents(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  char_count integer NOT NULL DEFAULT 0,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'complete', 'empty', 'failed')),
  extraction_error text,
  extracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_contents TO authenticated;
GRANT ALL ON public.document_contents TO service_role;

ALTER TABLE public.document_contents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_site_documents_updated_at ON public.site_documents;
CREATE TRIGGER update_site_documents_updated_at
BEFORE UPDATE ON public.site_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_contents_updated_at ON public.document_contents;
CREATE TRIGGER update_document_contents_updated_at
BEFORE UPDATE ON public.document_contents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can view their own site documents" ON public.site_documents;
CREATE POLICY "Users can view their own site documents"
ON public.site_documents
FOR SELECT
TO authenticated
USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can create their own site documents" ON public.site_documents;
CREATE POLICY "Users can create their own site documents"
ON public.site_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can update their own site documents" ON public.site_documents;
CREATE POLICY "Users can update their own site documents"
ON public.site_documents
FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by)
WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can delete their own site documents" ON public.site_documents;
CREATE POLICY "Users can delete their own site documents"
ON public.site_documents
FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can view content for their own documents" ON public.document_contents;
CREATE POLICY "Users can view content for their own documents"
ON public.document_contents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.site_documents d
    WHERE d.id = document_contents.document_id
      AND d.uploaded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create content for their own documents" ON public.document_contents;
CREATE POLICY "Users can create content for their own documents"
ON public.document_contents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.site_documents d
    WHERE d.id = document_contents.document_id
      AND d.uploaded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update content for their own documents" ON public.document_contents;
CREATE POLICY "Users can update content for their own documents"
ON public.document_contents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.site_documents d
    WHERE d.id = document_contents.document_id
      AND d.uploaded_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.site_documents d
    WHERE d.id = document_contents.document_id
      AND d.uploaded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete content for their own documents" ON public.document_contents;
CREATE POLICY "Users can delete content for their own documents"
ON public.document_contents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.site_documents d
    WHERE d.id = document_contents.document_id
      AND d.uploaded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can upload their own Project Bible files" ON storage.objects;
CREATE POLICY "Users can upload their own Project Bible files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-bible'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can read their own Project Bible files" ON storage.objects;
CREATE POLICY "Users can read their own Project Bible files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-bible'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own Project Bible files" ON storage.objects;
CREATE POLICY "Users can update their own Project Bible files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-bible'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'project-bible'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own Project Bible files" ON storage.objects;
CREATE POLICY "Users can delete their own Project Bible files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-bible'
  AND auth.uid()::text = (storage.foldername(name))[1]
);