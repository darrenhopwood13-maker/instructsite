
# Founder-owned organisation management

Give the founder account (`darrenhopwood13@gmail.com`) a global "Organisation" workspace: view every org, drill into an org's projects, and create brand-new organisations from a form. Each org stays fully isolated from every other org.

## Behaviour

**Header nav for the founder**
- Show **Organisation** (linking `/org`) instead of **Projects**. All other users are unchanged.

**`/org` as the founder**
- No "claim organisation" screen. Instead show every organisation as a tile grid, plus a prominent **+ New Organisation** button in the top-right.
- Each tile shows org name, slug, project count, member count, created date.
- Clicking a tile → `/org/$orgId`.

**`/org/$orgId` (founder only)**
- Header shows org name + slug.
- Lists every project in that org (via `projects.org_id = orgId`). Empty state offers **+ New Project in this org**.
- Members section reused from existing `listOrgMembers`, scoped to the target org.

**`/org/new` (founder only)**
- Form fields:
  - Organisation name (required, 2–120 chars)
  - Slug (required, auto-suggested from name, lowercase kebab, unique)
  - Company registration number (optional)
  - Primary contact name (optional)
  - Primary contact email (optional, validated email)
  - Primary contact phone (optional)
  - Registered address (optional, multiline)
  - Notes (optional, 0–1000 chars)
- On submit → creates the org and returns to `/org/$orgId`.

**Isolation guarantees (already true in schema, re-verified)**
- All scoped tables (`projects`, `snag_projects`, `snags`, `snag_comments`, `org_members`, etc.) key on `org_id`. Existing RLS policies scope reads/writes via `is_org_member(org_id, auth.uid())`. Creating a new org creates no cross-org rows.
- The founder is granted `master_admin` at first login, which already lets `is_project_admin` return true across every project — no extra grants needed for read access.

## Technical notes

**Owner detection**
- New helper `src/lib/owner.ts` exporting `OWNER_EMAIL = "darrenhopwood13@gmail.com"` and `isOwner(claims)` (case-insensitive email match on `context.claims.email`). Used inside server functions only.
- Client-side owner flag: header reads `supabase.auth.getUser()` email once in the existing `useEffect` and stores `isOwner` in state to switch the nav label/target.

**Schema migration (single migration)**
- Add nullable columns to `public.orgs`: `company_number text`, `contact_name text`, `contact_email text`, `contact_phone text`, `registered_address text`, `notes text`.
- Add SELECT policy `"Owner can view all orgs"` on `orgs` using an inline owner check via `auth.jwt() ->> 'email' = 'darrenhopwood13@gmail.com'` so the founder sees every org through the normal client without needing `supabaseAdmin`.
- Add matching SELECT policy on `org_members` and `projects` for the same owner email, so `/org/$orgId` reads work through RLS.
- No changes to `is_org_member` / `is_project_admin`; those keep working for regular users.

**Server functions (`src/lib/orgs.functions.ts`)**
- `getMyOrg`: if `isOwner(context.claims)`, short-circuit and return `{ role: "owner", orgId: null, org: null }`.
- New `listAllOrgs` (owner-only) — rejects non-owners, returns `[{id,name,slug,created_at, project_count, member_count}]` via `supabaseAdmin` with two aggregate queries.
- New `getOrgById({orgId})` (owner-only) — returns org row incl. new fields.
- New `listOrgProjects({orgId})` (owner-only) — projects filtered by `org_id`.
- New `listOrgMembersFor({orgId})` (owner-only) — same shape as `listOrgMembers` but for any org.
- New `createOrg({...form})` — owner-only, validates with Zod, generates slug via `slugify(name)` when omitted, checks slug uniqueness, inserts with `created_by = context.userId`. Returns `{ orgId }`.

**Routes**
- `src/routes/org.tsx`: branch on `role === "owner"` → render owner dashboard (grid + New Organisation CTA). Existing admin/subcontractor/claim UI stays for other users.
- New `src/routes/org.$orgId.tsx`: owner-only detail page (projects + members). Non-owners get access-denied.
- New `src/routes/org.new.tsx`: owner-only creation form using the same glass/aurora styling as `projects.new.tsx`.
- Header nav (`src/routes/__root.tsx`): swap the **Projects** link to **Organisation** when `isOwner`.

## Out of scope

- No change to subcontractor/claim flow for other users.
- No bulk import of orgs.
- No editing of existing orgs' details from the UI (can be added later; the fields are stored so the form is ready to be reused for edit).
- No cross-org data views (each org page is scoped strictly to its own `org_id`).
