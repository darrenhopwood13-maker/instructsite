## Goal
Produce a single ready-to-paste bundle containing the full blueprint background (CSS + SVG) that you can drop into the other instructSite project.

## What I'll do
Write one file: `/mnt/documents/blueprint-background-bundle.md` containing:

1. **CSS block** — copy of the relevant utilities from `src/styles.css`:
   - `@utility mesh-bg` (fixed full-screen navy canvas + radial gradients)
   - `.mesh-bg::before` / `.mesh-bg::after` (paper tint + legibility scrim)
   - `.mesh-blueprint` (the centered, masked SVG layer)
   - The `--background` / `--navy` root tokens so colours match

2. **SVG block** — the full `<div className="mesh-bg">…</div>` markup from `src/routes/__root.tsx` lines 154–506 (the sheet border, GA floor plan, sections, details, title block — all ~350 lines of technical linework).

3. **Placement instructions** for three target stacks:
   - TanStack Start → paste `<div className="mesh-bg">…</div>` into `src/routes/__root.tsx` inside the root providers, and wrap page content in `relative z-10`.
   - Next.js → paste into `app/layout.tsx` inside `<body>`.
   - Vite + React Router → paste into `src/App.tsx` at the top of the root component.
   - Plus: add the CSS to the project's global stylesheet (`src/styles.css` / `src/index.css` / `app/globals.css`) and ensure Tailwind v4 is set up (or replace `@utility` blocks with plain `.mesh-bg { … }` if the target uses Tailwind v3 or no Tailwind).

4. **Tailwind v3 / no-Tailwind fallback** — the same CSS rewritten as plain class selectors so it works even without Tailwind v4's `@utility` directive.

## Deliverable
A single markdown file at `/mnt/documents/blueprint-background-bundle.md`. Open it, copy the two code blocks, paste into the target project. No changes to this project's source.
