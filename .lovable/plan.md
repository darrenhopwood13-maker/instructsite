
# Instructsite Onboarding Pack — 5 PDF Editions

One flagship onboarding document, personalised into 5 downloadable PDFs (one per admin test account). Each PDF is identical in structure but the front cover and the "Your Login" panel are swapped per edition. Delivered as artifacts to `/mnt/documents/`.

## Deliverables

- `Instructsite_Onboarding_Admin1.pdf` … `Admin5.pdf` (approx 40–60 pages each)
- Each pack presented via `<presentation-artifact>` so the user can download them directly.

## Visual system (locked)

- Instructsite blue `#0B1D3A` + orange `#F26A21` on off-white pages, editorial dark cover.
- Zen Dots for display headers, Inter for body, mono for keyboard/UI callouts.
- Numbered orange step chips, thin blue rules, orange arrow SVG pointers overlaid on screenshots.
- Cartoon "Randall" — the 30-year veteran — reappears in speech bubbles with concrete time-saved commentary.
- Cartoon site-crew avatars for admin / QS / subcontractor personas.
- ROI micro-infographics (bar deltas, hours-saved dials, £ recovered counters) rendered as inline SVG.
- Every screenshot annotated with orange arrows, circled buttons, and step numbers.

## Structure of each PDF

1. **Cover** — cinematic dark hero, "Instructsite — the sharpest AI in contech", edition tag, Randall cameo.
2. **Cinematic Experience** — reworked in blue/orange: market pain, the instructsite answer, headline ROI stats, ROI panels, cartoon personas.
3. **Your Login (this edition)** — email, password, org name, link to `/auth`, first-run checklist.
4. **Claiming your organisation** — `/org` walkthrough, admin vs subcontractor cap explainer.
5. **Admin control surface** — MasterAdminHUD, TradeDirectoryPanel, permissions map.
6. **Setting up subcontractors** — invite link flow, 2-seat cap, revoke.
7. **Projects & workspaces** — `/projects/new`, tying a workspace back to DABS.
8. **DABS — Single Source of Truth** — tier-1 uploads, document contents, how DABS anchors every other module.
9. **Pin-dropping on DABS** — pins for information and permits, permit sign-off, hot-works / working-at-height auto-flagging.
10. **Site Manager's Diary & TWR** — daily flow, weather snapshot, checkout diary modal, force-checkout.
11. **The Randall Diary — programme → playbook → live progress**:
    - Drag-and-drop a line programme (P6 / MS Project / Asta / CSV) into the diary.
    - Randall parses tasks, dates, dependencies, trades and converts them into a **Daily Playbook** — per-day, per-trade, per-zone shift plan surfaced every morning.
    - Playbook becomes the yardstick: every DABS pin, checkout, and QS-approved diary is measured against planned progress in real time.
    - Live progress meter — planned % vs actual % per zone / trade / package — updates as diaries close and QS approves.
    - Slippage alerts, "trade behind by X hrs", auto-suggested catch-up moves.
    - Screenshots: upload dropzone → parsed task list → generated playbook → live progress dashboard → variance chart.
    - Randall bubbles: "no more Monday morning re-planning — 6 hours a week back per site manager".
12. **Snag Master** — `/snags` → new snag → GPT-4o Vision analysis → status lifecycle → comments.
13. **The other 6 AI tools** — one page each: AI Extract Project, Oracle Project Bible, Programme Compiler, AI Diary Auto-Populate, AI Snag Vision, Oracle Q&A — input → output screenshot pair and Randall commentary.
14. **Oracle** — how to ask, what it knows (Project Bible, DABS, diaries, snags, playbook), example prompts.
15. **QS Progress Sign-Off** — QsVerificationQueue, approving progress, payment verification, tie-back to Randall Diary planned-vs-actual.
16. **3D IFC + 2D Drawing progress verification** — BimModelUploader, BimModelViewer, BimMappingEditor, DrawingCanvas, ZoneMap, ZoneMatrixBoard; subcontractor claims progress, QS verifies against the model, playbook % updates.
17. **Subcontractor Dashboard** — `/subcontractor/$projectId`, submitting progress, receiving snags, seeing their slice of the playbook.
18. **Cheat sheet** — one-page nav map + Randall's "top 10 time savers".
19. **Back cover** — support routes, publish URL, edition tag, full login matrix.

## Content sourcing

- Screenshots: automated Playwright against `http://localhost:8080` using each admin's pre-minted session, 1280×1800, saved to `/tmp/onboarding/shots/`. Cropped + annotated with Pillow.
- Randall + personas: transparent PNGs via `imagegen`, reused across all 5 PDFs.
- ROI / cinematic infographics + programme-to-playbook diagram: inline SVG in Python, rasterised into the PDF.
- Copy written in-doc; Randall bubbles carry the veteran voice with concrete time-saved deltas.

## Technical build

- Python + ReportLab for layout. Bundled Inter + Zen Dots TTF via `pdfmetrics.registerFont`.
- Shared `build_pack.py` renders the master doc; a thin wrapper loops the 5 admin accounts, swaps cover title + login panel, writes 5 PDFs.
- QA: `pdftoppm` every PDF to page images, spot-check every page for overflow, mis-aligned arrows, low-contrast text, missing images — fix and re-render before delivering.

## Login block

```text
admin1@snagmaster.test  ·  SnagMaster2026!  ·  Test Org 1
admin2@snagmaster.test  ·  SnagMaster2026!  ·  Test Org 2
admin3@snagmaster.test  ·  SnagMaster2026!  ·  Test Org 3
admin4@snagmaster.test  ·  SnagMaster2026!  ·  Test Org 4
admin5@snagmaster.test  ·  SnagMaster2026!  ·  Test Org 5
```

Each PDF's "Your Login" page shows only its own credentials; the full matrix reprints on the back cover.

## Out of scope

- No app code changes. The "asks for an organisation" gate on `/snags` is intentional (multi-tenant claim) and is explained inside the pack. If you want that removed or auto-claimed on first login, that's a separate change after the pack ships.

Approve and I'll build all 5 PDFs end-to-end, run visual QA on every page, and deliver them as download artifacts.
