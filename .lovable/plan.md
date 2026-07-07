
# Experience Page — Light, Alive, and Money-Talking

Rework `/experience` from a dark cinematic teaser into a bright, playful, information-rich marketing page that mirrors the actual InstructSite cockpit and proves ROI in hard numbers.

## 1. Palette + Mood Reset

Shift from near-black to a warmer, brighter surface while keeping the electric orange / purple / green accents from the real app.

- Background: soft off-white `#F7F5F1` with subtle warm gradient washes (peach, lilac).
- Ink: deep slate `#0F172A` for body text (kept for legibility, not for backgrounds).
- Accents (matching app):
  - DABS Orange `#FB923C`
  - Oracle Purple `#8B5CF6`
  - QS Verified Green `#10B981`
  - Randall Amber `#F59E0B`
- Playful touches: floating gradient blobs, tape/sticker labels, micro-confetti on ROI reveal, spring-y hover bounces.

## 2. Replace the Phone Mock with the Real Cockpit

Rebuild the Command Module section around a pixel-faithful recreation of the InstructSite subcontractor cockpit (`/subcontractor/$projectId`) rendered as a live-looking mock, not a stock phone image.

Contents of the mock (matching current app):
- Top bar: project name, live weather chip (12°C · Cloudy), time.
- 6 command tiles with the real colour dots and labels: INSTALL·DABS, SAFETY·SENTINEL, PROCURE·RANDALL, DRAWINGS·DABS, SNAG·QS, ASSIST·ORACLE.
- Purple floating Oracle FAB bottom-right.
- Animated: a tile pulses, tooltip callouts point to DABS + Oracle FAB with framer-motion.

Bonus: a second device mock next to it showing the site-manager cockpit (Zone Matrix / QS Verification Queue) so viewers see both audiences.

## 3. Interactive ROI Matrix (the headline feature)

A big, bright, tactile calculator titled "How much is paper costing you?"

Inputs (sliders + steppers):
- Managers on site: 1–20
- Average manager day-rate: £250–£800 (default £450)
- Adoption %: 10, 20, 30, … 100 (default 70%)
- Working days / month: default 21

Fixed time-savings model (from user brief):
- DABS drawings→sequences: 40 min / manager / day
- Daily diaries + progress recording: 60 min / manager / day
- QS payment verification: 120 min / manager / week (÷5 → 24 min/day)
- Total: 124 min/day/manager at 100% adoption, scaled linearly by adoption %.

Live outputs (spring-animated counters):
- Hours saved / day, week, month, year
- £ saved / month, / year
- Equivalent extra site managers unlocked (hours ÷ 8)
- Payback period vs InstructSite cost (assume £X/manager/month placeholder, editable constant)

Visuals:
- Horizontal stacked bar splitting the saved minutes by module (orange DABS, purple Diary, green QS).
- Big number display with animated £ counter and a confetti burst when > £100k/year.
- "Share this result" button (copies a summary string — no backend).

## 4. New Information Sections

Fold in real product depth so it reads like a brochure, not a teaser:

- **Six Modules, deep-dive cards** — expandable cards per module (DABS, Sentinel, Randall, Drawings, QS Verifier, Oracle) with what it does, who it's for, and the time it saves.
- **A Day in the Life** — timeline strip (07:00 toolbox → 17:00 diary auto-filed) showing where each module fires.
- **Verification Engine** — keep, but on light background with the mesh painting green as you scroll.
- **Randall slider** — keep the Gantt→Diary drag, restyled bright.
- **Security & Compliance** — CDM 2015, RAMS, permits-to-work, RLS-backed data, audit trail.
- **FAQ** — 6 questions: onboarding time, offline use, existing programme import, data ownership, pricing model, cancel anytime.

## 5. Clients + Testimonials (fabricated placeholders, clearly plausible)

Logo wall (text-based faux logos, no real trademarks): Meridian Build Group, Halcyon Interiors, Northwark Civils, Blackfriars Fit-Out, Kelvin & Rowe, Ostara Developments.

Testimonial cards (3, with headshots via initials avatars):
- "We closed a £1.2M valuation in 40 minutes instead of two days." — Site QS, Meridian Build Group
- "My site managers stopped drowning in WhatsApps. Diaries file themselves." — Ops Director, Halcyon Interiors
- "Randall gave me back my Sundays." — Senior PM, Northwark Civils

Case-study strip: 3 mini metrics cards (hours saved, £ recovered, snags closed) with big numbers.

## 6. Motion + Polish

- Keep framer-motion driving parallax, but reduce dark overlays. Motion should feel bouncy (spring stiffness 180, damping 20), not cinematic-heavy.
- Sticky top progress bar tinted with the current section's accent.
- Section headers use the existing display font with orange/purple splits from user's earlier direction.
- Reduce-motion respected via `prefers-reduced-motion`.

## Technical Notes

- File: rewrite `src/routes/experience.tsx` end-to-end.
- No new routes, no DB, no server functions. Purely presentational.
- ROI calc: pure React state, `framer-motion` `animate` on numeric spring.
- Cockpit mock: hand-built JSX+Tailwind (no iframe of the real app) so it renders instantly and is stylable.
- Add lightweight SVG faux-logos inline; no external image fetches.
- Head/meta on this route updated: title "InstructSite — See the Cockpit. Count the Hours.", matching description + og tags.
- Respect design tokens; add any new light-mode tokens in `src/styles.css`, not hardcoded hex.

## Out of Scope

- No changes to the actual cockpit routes or backend.
- No new PWA assets.
- No real client logos or third-party imagery.

Confirm and I'll build it.
