## Plan

1. **Fix the upload permissions path**
   - Update the Project Bible upload flow so files are uploaded under the signed-in user path, not `anonymous`.
   - If no signed-in user is available, show a clear upload error instead of attempting a storage write that fails RLS.

2. **Move metadata + extraction into an authenticated server function**
   - Replace the browser-side `site_documents` insert with a server function that runs after upload and records metadata reliably.
   - Use the current user identity for `uploaded_by` so table policies can match correctly.

3. **Make text extraction reliable and visible**
   - Keep PDF-to-text extraction for normal PDFs.
   - Store extraction status details in `document_contents` so Oracle can tell the difference between “no documents”, “documents exist but not extracted”, and “no matching snippets”.
   - Return extraction errors to the upload UI instead of silently hiding them.

4. **Update Oracle retrieval**
   - Query `document_contents` directly with the linked `site_documents` record.
   - If documents exist but have empty content, make the AI response say that extraction did not find readable text, rather than claiming there are no Project Bible documents.

5. **Database/storage policy patch**
   - Add a migration for the `project-bible` bucket and policies that allow authenticated users to upload/read their own files.
   - Add/fix grants and RLS policies for `site_documents` and `document_contents` so authenticated app flows can insert/read them and server-side extraction can operate.

6. **Verify the flow**
   - Check that upload no longer hits the storage RLS error.
   - Confirm a document row and content row are created.
   - Confirm Oracle uses stored extracted text or reports a precise extraction issue.