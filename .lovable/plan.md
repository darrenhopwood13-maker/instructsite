## Problem

Selecting a drawing in the viewer throws `Source file missing`. The `project_drawings` row loads (its RLS policy allows project members), but the joined `site_documents` row is hidden because `site_documents` policies only match the original uploader. The handler correctly reads that as "no file linked" and errors out.

This affects every teammate view of every Tier-1 document (drawings, logistics plans, RAMS) — not just Oracle sessions.

## Fix

Realign `site_documents` visibility with the parent tables it belongs to, so anyone who can see a drawing / logistics plan / RAMS record can also see the underlying file record.

### Migration

Replace the four owner-only policies on `public.site_documents` with member-scoped ones:

- SELECT — allowed when the caller is a project member of `project_id`, OR is the original uploader (covers the brief window before a document is attached to a specific project).
- INSERT — allowed when the caller is a project member and `uploaded_by = auth.uid()`.
- UPDATE / DELETE — allowed when the caller is a project admin (master / project admin) or the original uploader.

This uses the existing `is_project_member` / `is_project_admin` security-definer functions, matching how `project_drawings`, `logistics_plans`, and `rams_documents` already gate access.

No code changes required — the server functions already fetch the joined record; they'll just start receiving it for every legitimate viewer.

## Verification

- Open a drawing in the viewer as an Oracle-session user on a project they didn't originally upload to → preview renders, Open / Download links work.
- Direct-link generation and RAMS list continue to work for the uploader.
- Non-members of a project still cannot see the underlying files.
