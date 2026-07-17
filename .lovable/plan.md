## Goal

Add a **Project Bible** button to the top nav (next to the AI tooling entry) that opens a page listing every document uploaded to the current project. Each document is shown as a preview card with title/metadata and a **View** button that opens the file full-screen for review.

## 1. Nav button

Edit `src/routes/__root.tsx`:
- Add a `BookOpen` icon link labelled **Project Bible** next to the Oracle/AI tooling entry.
- Only render it when a `projectId` is available in context (derived from the current route params — `projects.$projectId`, `programme.$projectId`, `dabs.$projectId`, `site-manager.$projectId`, etc.). Falls back to a disabled state with a tooltip "Open a project first" on non-project pages.
- Route target: `/projects/$projectId/bible`.

## 2. Project Bible page

New route `src/routes/projects.$projectId.bible.tsx` (under `_authenticated` if the existing project pages are — matching the sibling `projects.$projectId.tsx`).

Loader fetches the full document set for the project via a new server function `listProjectBibleDocuments({ projectId })` in `src/lib/project-bible.functions.ts`:
- Uses `requireSupabaseAuth`; RLS-scoped through `context.supabase`.
- Unions `site_documents` referenced from `project_drawings`, `logistics_plans`, `rams_documents` (via existing `site_document_project_ids` pattern) plus programme uploads and any snag PDFs linked to the project.
- Returns: `{ id, title, category, fileName, mimeType, sizeBytes, uploadedBy, uploadedAt, bucket, filePath, extractionStatus }[]`.

Page UI (matching InstructSite theme, semantic tokens only):
- Header band: project name + doc count + category filter chips (Drawings, RAMS, Logistics, Programme, Snags, Other).
- Grid of **preview cards** (`bg-card border rounded-lg`):
  - Thumbnail: for PDFs, first-page preview using `<embed>` with `#toolbar=0&view=FitH`; for images, `<img>`; for other types, a labelled file-type badge.
  - Title, category badge, uploader name, uploaded date, file size, extraction status pill.
  - **View** button (primary) and **Download** button (secondary).

## 3. Full-screen viewer

Clicking **View** opens `src/components/project-bible/DocumentViewerDialog.tsx`:
- Radix `Dialog` in fullscreen mode (`max-w-none w-screen h-screen inset-0`).
- Fetches a signed URL via new server fn `getSignedDocumentUrl({ documentId })` (60-min TTL, RLS-guarded by `can_view_site_document`).
- Renders PDFs in an `<iframe src={signedUrl} />` filling the viewport.
- Renders images with `<img>` centered.
- Renders other formats with a fallback: filename + "Download to view".
- Header bar with title, close (Esc), download, and open-in-new-tab.

## 4. Files to add / edit

Add:
- `src/routes/projects.$projectId.bible.tsx`
- `src/components/project-bible/DocumentCard.tsx`
- `src/components/project-bible/DocumentViewerDialog.tsx`
- `src/lib/project-bible.functions.ts` (`listProjectBibleDocuments`, `getSignedDocumentUrl`)

Edit:
- `src/routes/__root.tsx` — add Project Bible nav button.

## Out of scope

- Upload UI on this page (uploads still happen from existing surfaces — Drawings, RAMS, Logistics, Programme, Snags).
- Editing/deleting from the bible view.

Confirm and I'll build it.
