
# instructSite User Manual — Plan

Deliver one comprehensive manual in two forms: a branded PDF you can download/print/share, and an in-app `/manual` page that mirrors it with search and deep-links into the actual screens. Screenshots are captured live from the running app while signed in as the founder.

## What the manual covers (in order)

1. **The Big Picture** — what instructSite is, who does what (Founder, Master/Project Admin, Site Manager, PM, Subcontractor), and the top-nav map (Projects vs Organisations, Snag Master, Project Bible, AI Tooling, Notifications).
2. **Setting up an Organisation** (Founder only) — where the button lives, every field explained, what happens on save.
3. **Inviting people to an Organisation** — the 3 standard seats (1 PM + 2 Subs), invite emails, magic link → password → accept invite flow, common errors.
4. **Creating a Project inside an Org & inviting Subcontractors** — New Project form, scope brief, then adding subcontractors to that project.
5. **Project Scope, Drawings, Logistics Plans, RAMS** — where each lives on the Project page, who can upload, what formats, how they appear in the Project Bible.
6. **Adding Drawings to DABS to create Work Zones** — opening DABS, picking a project drawing, drawing zones, saving, who sees them.
7. **Adding a Programme to Randall's Diary** — uploading the programme PDF, what Randall extracts, editing days, troubleshooting a failed parse.
8. **Bonus quick-refs** — Snag Master (scan → report → Project Bible), AI Tooling cockpit (Scan/Upload/View + Oracle), Notifications bell, Weekly Subcontractor Pack.

Each section uses the same repeating block so it's genuinely fool-proof:

```text
WHO   – which role(s) can do this
WHERE – exact path + which button, with a screenshot
WHEN  – at what stage of the project lifecycle
HOW   – numbered steps, one action per step
HINT  – yellow callout: gotchas, e.g. "Founder sees Organisation, everyone else sees Projects"
IF IT BREAKS – common error + fix
```

## How screenshots are captured

Playwright drives the live preview at `http://localhost:8080`, signed in as the founder using the injected Supabase session. For each step the script:

1. Navigates to the target route.
2. Waits for the key element (button, form, panel).
3. Screenshots the viewport (1280×1800) or the specific element.
4. Saves to `/tmp/manual/shots/NN_slug.png`.

Founder-only screens (Organisations, New Org, Director Portfolio) are captured as the founder. Role-restricted screens where the founder view differs (e.g. Subcontractor Cockpit) get a short note explaining what a subcontractor would see instead, using an existing test account if needed.

Every generated PNG is inspected before it goes into the PDF — blurry, half-loaded, or wrong-page shots get re-taken.

## PDF generation

Python + ReportLab, using the instructSite brand:

- Cover page: Zen Dots title "instructSite — Operator's Manual", navy `#0B1E3F` background, orange `#FF7A00` accent, version + date.
- Body: Inter for text, Space Grotesk for headings, orange section dividers, WHO/WHERE/WHEN/HOW blocks styled as cards, yellow HINT callouts, red IF-IT-BREAKS callouts.
- Screenshots embedded inline with numbered captions.
- Table of contents with page numbers, and a role-based quick-reference index at the back ("If you are a Subcontractor, read sections 1, 3, 5, 8").
- Output written to `/mnt/documents/instructSite-manual.pdf` and surfaced with a `<presentation-artifact>` tag so you can download it immediately.
- Full visual QA pass: render every page to JPG, read each one, fix any overflow / clipping / broken layout before delivery.

## In-app `/manual` page

New route `src/routes/manual.tsx`:

- Same content as the PDF, rendered as React with the existing glass-panel styling.
- Left-hand sticky table of contents; sections use anchor IDs so links are shareable.
- Search box that filters section titles + body text client-side.
- Each "WHERE" block includes a live `<Link>` straight to the screen it describes (e.g. WHERE for "New Organisation" links to `/org/new`).
- A prominent "Download PDF" button at the top pointing at the generated PDF URL.
- Header nav gets a small "Manual" link next to "Project Bible" so it's always one click away.
- Route is public within the app (any signed-in user); founder-only sections carry a small badge but are still visible so everyone understands the full system.

## Technical notes

- New files: `src/routes/manual.tsx`, `src/components/manual/*` (ManualSection, HintBox, StepList, ScreenshotFigure), plus a generator script at `scripts/build-manual-pdf.py` and the Playwright capture script at `scripts/capture-manual-shots.py`.
- Screenshots that ship in the app go through `lovable-assets create` so they're served from the CDN, not committed as binaries.
- No changes to backend logic, RLS, or any existing feature — this is documentation + one new page + one new header link.
- Content is written from a fresh walk-through of the real UI, not from memory, so anything that no longer exists gets flagged and either corrected or omitted.

## Deliverables at the end

1. `instructSite-manual.pdf` in your Files (downloadable, printable).
2. `/manual` route inside the app with the same content, searchable, deep-linked.
3. A "Manual" link in the top nav.
4. A short summary of anything I found in the walk-through that looked stale or broken, so you can decide whether to fix it separately.
