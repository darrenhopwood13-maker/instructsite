## Goal

Two changes, done together:

1. Swap the current navy + orange palette for the **forest-green InstructSite theme**.
2. Make every screen work cleanly on **phone, tablet, and laptop/desktop**.

No feature/business-logic changes — visual + layout only.

---

## Part 1 — Forest Green Theme

### Where the colors live
All colors are semantic tokens in **`src/styles.css`** (`:root` + `.dark` + `@theme inline`). Components use `bg-primary`, `text-foreground`, `bg-navy`, `glass-orange`, etc. — so re-skinning is 95% a single-file edit.

### Token remap

| Token | Now (navy/orange) | New (forest green) |
|---|---|---|
| `--background` | deep navy | deep forest `oklch(0.16 0.03 155)` |
| `--primary` | navy | forest green `oklch(0.35 0.09 155)` |
| `--navy` | navy | deep pine `oklch(0.22 0.06 155)` |
| `--accent` / `--ring` / `--alert` | orange `oklch(0.7 0.19 47)` | moss/gold accent `oklch(0.68 0.14 130)` (or warm amber `oklch(0.72 0.14 85)` — see question below) |
| `--sidebar` | dark navy | dark forest |
| `--destructive` | red | unchanged |
| `.dark` variants | navy-tinted | forest-tinted equivalents |

### Utility classes to re-tint
The custom `@utility` blocks in `src/styles.css` hard-code orange/navy rgba values and must be updated to match:
- `glass-accent`, `glass-btn`, `glass-navy`, `glass-orange` → rename kept, swap `rgba(249,115,22,…)` (orange) → new accent, `rgba(11,30,63,…)` (navy) → forest green.
- `aurora-bg`, `permit-flash`, `scan-sweep`, `oracle-pulse` → same rgba swap.

### Component audit (hard-coded colors to remove)
Grep pass for `text-white`, `bg-black`, `bg-[#`, `text-[#`, `#0b1e3f`, `#f97316`, `rgba(249,115,22`, `rgba(11,30,63` across `src/components/**` and `src/routes/**`, and replace with semantic tokens (`bg-primary`, `text-primary-foreground`, `bg-navy`, `text-accent`).

Expected hotspots based on file list:
- `MasterAdminHUD.tsx`, `TradeDirectoryPanel.tsx`
- `DrawingCanvas.tsx`, `ZoneMap.tsx`, `ZoneMatrixBoard.tsx`, `BimModelViewer.tsx`
- `dashboard.tsx`, `site-manager.$projectId.tsx`, `subcontractor.$projectId.tsx`, `oracle.tsx`, `unlock.tsx`, `auth.tsx`

---

## Part 2 — Responsive Sweep (phone / tablet / laptop)

### Approach
Tailwind breakpoints: **default = mobile**, `sm:` ≥640, `md:` ≥768 (iPad portrait), `lg:` ≥1024 (iPad landscape / small laptop), `xl:` ≥1280.

Pass through each route + heavy component and fix these recurring patterns:

1. **Header rows** with title + widgets → convert to
   `grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:flex sm:flex-wrap sm:justify-between`
   with `min-w-0` on text container, `shrink-0` on icons, `truncate` on headings.
2. **Multi-column dashboards** (`grid-cols-3`, `grid-cols-4`) → start at `grid-cols-1`, promote at `md:grid-cols-2 lg:grid-cols-3`.
3. **Fixed widths / large paddings** → responsive: `p-4 md:p-6 lg:p-8`, `text-2xl md:text-3xl lg:text-4xl`.
4. **Side-by-side split screens** (site manager cockpit, portfolio dashboard) → stack vertically on mobile, split at `lg:`.
5. **Modals & sheets** → `w-full max-w-md` on mobile, larger at `sm:`.
6. **Tables** (QS queue, trade directory) → horizontal scroll wrapper `overflow-x-auto` + `min-w-[640px]` on `<table>` for phone.
7. **PDF/BIM canvases** → `aspect-video` or fluid height with `max-h-[70svh]` so they don't overflow on phones.
8. **Touch targets** — buttons min-height `h-10` on mobile (`h-9 md:h-8`).
9. **Sidebar** → collapse to `Sheet`/drawer on `<lg` (shadcn sidebar already supports this — verify wiring).

### Route-by-route pass
`index`, `auth`, `unlock`, `dashboard`, `projects.index`, `projects.$projectId`, `projects.new`, `site-manager.$projectId`, `subcontractor.$projectId`, `dabs.$projectId`, `oracle`, `invite.$token`, `subcontractors.new`.

### Verification
After edits, drive Playwright headless at three viewports (390×844 iPhone, 820×1180 iPad, 1440×900 laptop), screenshot each key route, view the images, fix anything visibly broken.

---

## Deliverables
- Updated `src/styles.css` (tokens + `@utility` blocks) — forest green.
- Component sweep replacing hard-coded colors with tokens.
- Responsive class additions across routes/components (no logic changes).
- Playwright screenshot proof at 3 viewports for the main routes.

## Effort
Not hard. Palette swap is ~1 file. The responsive sweep is the bulk of the work — mechanical but touches ~20 files. Realistically one focused build turn.

---

## One question before I build

**Accent color** — the current app uses orange as the "action / alert" accent against navy. For forest green, which accent do you want?
- **Warm amber / gold** (classic forest+gold, high contrast, keeps the "alert / CTA" energy)
- **Moss / lime** (all-green, calmer, more monochrome)
- **Match the other InstructSite app exactly** — if so, paste a screenshot or the hex values and I'll mirror them.
