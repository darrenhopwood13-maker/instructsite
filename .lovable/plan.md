# Mobile logo fix + livened-up tagline

## 1. Stack the logo on mobile (landing + auth pages)

**Problem:** `instructSite` at `text-7xl` (~72px) using the wide `Zen Dots` font overflows narrow phone screens (~360px).

**Fix — `src/routes/index.tsx` (landing hero, lines 42–48):**
- Change H1 to `text-5xl sm:text-7xl md:text-8xl lg:text-9xl` (down from `text-7xl` base).
- On mobile, stack: put `instruct` (orange) on its own line above `Site` (white) using `<span className="block sm:inline">`. From `sm:` upward it goes back to inline on one line.
- Tighten `leading-none` → `leading-[0.9]` so the two stacked words sit close.

**Fix — `src/routes/auth.tsx`:** The auth page has its own `instructSite` wordmark further down the file (not shown in the excerpt above). I'll locate it and apply the same responsive `block sm:inline` + smaller mobile size treatment so the two pages stay consistent.

No changes to desktop layout — `sm:` and up render exactly as today.

## 2. Jazz up the "Turn 2D drawings into instant…" line + surface the 6 AI tools

**Current (index.tsx line 49–54):** Two flat grey paragraphs.

**Replacement:**
- Line 1 becomes a bolder, animated headline in a livelier display font (reuse `Zen Dots` at smaller size, or switch to `'Space Grotesk'` for contrast — I'll pick Space Grotesk so it feels distinct from the logo). Copy: **"Turn complex 2D drawings into instant, plain-English sequences."** with the words **"instant, plain-English"** wrapped in an orange gradient text span with a subtle shimmer.
- Add a compact chip row directly below listing the 6 AI tools the platform ships with — matches the existing `glass-panel` / orange-accent visual language:

  1. **Oracle** — Project Bible extraction
  2. **DABS AI** — daily briefing compiler
  3. **Randall** — programme-to-diary playbook
  4. **BIM Auto-Allocator** — 10k+ IFC elements in seconds
  5. **QS Verifier** — photo-evidence progress check
  6. **Permit Sentinel** — high-risk auto-flagging

  Rendered as 6 small pill chips (`grid grid-cols-2 sm:grid-cols-3 gap-2`) with an orange dot + tool name + one-line desc — sits between the tagline and the CTA buttons.

- Keep the existing 4-tile feature grid at the bottom (DABS / IFC / QS / Permits) — it's a different summary and still useful.

## Files touched

- `src/routes/index.tsx` — responsive H1 + new tagline treatment + 6-tool chip row
- `src/routes/auth.tsx` — responsive H1 on the auth-page wordmark (locate + patch)

## Out of scope

- No changes to colours, CSS tokens, other routes, or business logic.
- No new fonts loaded unless Space Grotesk isn't already available — I'll check `src/routes/__root.tsx` during build and only add a `<link>` if missing.
