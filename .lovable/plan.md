## Standalone Guided Demo Export

Package the `GuideDemo` player as a self-contained, downloadable HTML file that runs anywhere — no build step, no React toolchain, no instructSite dependencies. Open it in any browser (or host it on any static server) and it plays.

### What you get

A single file: `/mnt/documents/guided-demo-standalone.html`

- One HTML file, ~40–60 KB, no external requests except Tailwind Play CDN + React UMD (or fully inlined if you'd rather — see options below).
- Contains the demo engine, mock screens, controls (play/pause/restart/step/speed), captions, written-steps list, glossary tooltips, autoplay-on-scroll, reduced-motion support.
- Uses the instructSite dark tokens (navy `#0B1E3F`, orange `#FF7A00`, Inter/Space Grotesk) so it looks identical to the in-app version.
- Ships with the 10 setup missions already loaded, same content as `/start`.

### How it will be built

1. Port `GuideDemo.tsx`, `Term.tsx`, `missions.ts`, `MissionMocks.tsx` into one HTML file using React + ReactDOM UMD builds and Babel-standalone for JSX (dev-only, but fine for a standalone demo file).
2. Inline the glossary, mission scripts, and mock screens.
3. Inline the CSS tokens and print stylesheet.
4. Save to `/mnt/documents/guided-demo-standalone.html` and surface it as a `<presentation-artifact>` so you can download it directly.

### Options — pick one before I build

- **A. CDN-backed (smaller, needs internet):** React + Tailwind pulled from CDN. ~40 KB file, opens instantly, requires internet the first time.
- **B. Fully offline (bigger, no internet needed):** Everything inlined including React runtime. ~400 KB file, works with no network at all — good for USB sticks / air-gapped demos.
- **C. Both:** I generate both files.

### Not included (say if you want them)

- A packaged npm component (`@instructsite/guide-demo`) for embedding in other React apps.
- A recorded MP4/GIF of the demo playing (would need headless browser capture).
- A PDF storyboard of each mission's steps.

Confirm A, B, or C (and any extras) and I'll build it.