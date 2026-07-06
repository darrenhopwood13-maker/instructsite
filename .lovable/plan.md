
# InstructSite Sales Brochure — Plan

A downloadable, investor/partner-grade PDF brochure that sells InstructSite end-to-end. Rendered as a high-resolution PDF, saved to `/mnt/documents/`, and exposed via a "Download Brochure" button on the landing page.

## Visual direction

Match the live app:
- Deep obsidian background (`#0a0a0f`), warm orange primary (`#ff7a00`), off-white body text, subtle grid/technical-drawing motif from `__root.tsx`.
- Display face: **Zen Dots** for the `instructSite` wordmark and section numerals; **Inter Tight** for headings; **Inter** for body.
- Small-caps alert labels in orange with wide letter-spacing (`0.35–0.5em`), thin hairline dividers, and glass-panel cards — same language as the app.
- Faint isometric/technical construction drawing lines in the margins on every spread (echoing the hero background), never obscuring text.

## Structure (10 pages, A4 portrait)

1. **Cover** — full-bleed dark, giant `instructSite` wordmark, tagline "Turn complex 2D drawings into instant, plain-English sequences.", subtitle "The AI command surface for construction site operations.", faint GA drawing behind.
2. **The problem** — construction's information gap: fragmented drawings, verbal briefings, disputed progress, lost hours. Three stat callouts.
3. **The single source of truth** — hero diagram: DABS → Site Manager Diary → QS Verification → IFC Model, one continuous flow. Orange arrows, numbered nodes.
4. **DABS — Daily AI Briefing Sheet** — how the Oracle turns drawings into plain-English sequences; screenshot-style mock panel; bullet benefits.
5. **The Oracle (AI core)** — describe the AI tools: drawing extraction (Gemini), Randall auto-zone allocation, project-bible upload, plain-English queries. Visual: shimmering oracle orb mock.
6. **Site Manager Diary** — live activity, checkout, permits, force-checkout. Card grid of features.
7. **QS Verification & IFC Payment Applications** — the killer feature: zones flip green on QS approval, live 3D model drives payment application. Diagram of zone → verify → % complete → invoice.
8. **Subcontractor Smart-Phone Portal** — mobile mock; drawings, ask Oracle, lock-to-oracle, one-tap check-in.
9. **Why instructSite wins** — 4-tile grid: 30-year vets get edge, 30-day starters get confidence, disputes vanish, payments accelerate. Optional pricing/trial CTA.
10. **Back cover** — big CTA "Start 7-day free trial", URL `instructsite.com`, wordmark, contact line.

## Technical approach

- Generate with **ReportLab** (Python) for pixel control — canvas-level layout, custom fonts, precise vector shapes for the technical-drawing motif and flow diagrams.
- Register Google Fonts (Zen Dots, Inter Tight, Inter) as TTF; download via `curl` to `/tmp/`.
- One script `/tmp/brochure/build.py` producing `/mnt/documents/instructsite-brochure.pdf`.
- Vector-draw the flow diagram, oracle orb (radial gradient via layered circles), phone mockup, and margin drawings — no external images needed except optional hero.
- After render: `pdftoppm` each page to JPG, view each, iterate until every page passes visual QA (no overflow, no clipping, palette consistent, wordmark crisp).

## App integration

- Add a "Download brochure" glass button on `src/routes/index.tsx` next to the existing CTAs, linking to `/instructsite-brochure.pdf` served from `public/`.
- Copy the finished PDF into `public/` so it's downloadable from the live site as well as from `/mnt/documents/`.

## Deliverables

- `/mnt/documents/instructsite-brochure.pdf` (embedded via `<presentation-artifact>`)
- `public/instructsite-brochure.pdf` (downloadable from the live app)
- Landing-page CTA button linking to it

## Not in scope

- No new backend, data, or auth changes.
- No changes to Oracle/IFC/diary logic — visual/marketing artifact only.
