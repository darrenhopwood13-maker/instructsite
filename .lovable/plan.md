# InstructSite Visual Rebrand — Cinematic Emerald (v2)

Purely visual. No feature, route, data, or auth changes. No apprentice-access content added.

## Locked visual direction (from preview v2)
- Header background: rich emerald gradient `#043d2f → #059669`
- Floating multi-layered animated **white** 3D wireframe mesh + soft white particle dots (parallax)
- Wordmark: "instructSite" in Zen Dots
- Headline: "The Oracle for the Construction Ecosystem."
- Glossy 3D bright-emerald circular orb action buttons with hover scale animation
- Frosted white pill dropdowns with `backdrop-blur`
- Cinematic photo cards (2-col) with dark gradient overlay, bold white type, emerald outline icons
- Palette: emerald + white only. No orange/gold/amber/black-heavy surfaces.

## Implementation steps

1. **Design tokens** (`src/styles.css`)
   - Add emerald scale + gradient tokens: `--emerald-deep`, `--emerald-mid`, `--emerald-glow`, `--gradient-header`, `--shadow-orb`, `--shadow-cinematic`
   - Map to shadcn semantic tokens under `@theme inline` (primary → emerald)
   - Add `@utility` for `.orb-button`, `.glass-pill`, `.cinematic-card`

2. **Fonts** (`src/routes/__root.tsx` head links only)
   - Preconnect + `<link>` Google Fonts: **Zen Dots** (wordmark), **Space Grotesk** (headline), **Inter** (body)
   - Reference families in `@theme` `--font-display`, `--font-heading`, `--font-sans`
   - Update `<title>` / meta to "instructSite — The Oracle for the Construction Ecosystem"

3. **Animated mesh background component** (new `src/components/MeshBackground.tsx`)
   - Layered SVG: 2–3 wireframe wave paths + particle dots
   - CSS keyframe drift + parallax translate on scroll (no libs)
   - White strokes at varying opacity over emerald gradient parent

4. **Header** (existing header component — visual swap only)
   - Emerald gradient bg + `<MeshBackground />` absolute layer
   - Zen Dots wordmark, Space Grotesk tagline
   - Nav dropdowns: `bg-white/70 backdrop-blur-xl` pills

5. **Action buttons / tool cards** (existing components)
   - Primary CTAs → glossy emerald orb variant (radial-gradient, inset highlight, `shadow-orb`, `hover:scale-105 transition`)
   - Tool grid cards → cinematic photo bg + dark gradient overlay + white bold label + emerald stroke icon
   - Use existing Unsplash/construction imagery already referenced, or add emerald-tinted CSS gradient placeholders where images are absent

6. **Global surfaces**
   - Remove any orange/amber utility classes; replace with emerald tokens
   - Ensure dropdowns/popovers use `backdrop-blur-xl bg-white/70 border-white/40`

## Out of scope
- No routing, loader, server function, DB, or auth changes
- No new features, no apprentice-access UI/content
- `src/routeTree.gen.ts` untouched (auto-generated)

## Files touched (visual only)
- `src/styles.css`
- `src/routes/__root.tsx` (head: fonts + meta)
- `src/components/MeshBackground.tsx` (new)
- Existing header / hero / action-button / tool-card components (className + wrapper markup only)
