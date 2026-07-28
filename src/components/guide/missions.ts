import type { GuideStep } from "./GuideDemo";

import shot01 from "@/assets/guide/guide-01-organisations.png.asset.json";
import shot02 from "@/assets/guide/guide-02-new-organisation.png.asset.json";
import shot05 from "@/assets/guide/guide-05-new-project-fields.png.asset.json";
import shot09 from "@/assets/guide/guide-09-active-drawings.png.asset.json";
import shot11 from "@/assets/guide/guide-11-project-bible.png.asset.json";
import shot12 from "@/assets/guide/guide-12-dabs-pin-drop.png.asset.json";
import shot13 from "@/assets/guide/guide-13-dabs-shift-closeout.png.asset.json";
import shot15 from "@/assets/guide/guide-15-site-manager-command-tower.png.asset.json";
import shot16 from "@/assets/guide/guide-16-snag-master.png.asset.json";
import shot17 from "@/assets/guide/guide-17-the-oracle.png.asset.json";

export interface Mission {
  id: string;
  number: number;
  title: string;
  why: string;
  deepLink: string;
  ifWrong: string;
  steps: GuideStep[];
  shot: { url: string };
  shotAlt: string;
}

/* Hotspots are % of the screenshot (x, y, w, h). Estimated from the live UI;
   tweak as needed without touching the engine. */

export const MISSIONS: Mission[] = [
  {
    id: "m1",
    number: 1,
    title: "Create your organisation",
    why: "Everything in instructSite lives inside your organisation. Set it up once and your whole team joins in.",
    deepLink: "/org/new",
    ifWrong: "If the CREATE button is greyed out, fill in the name field first.",
    shot: shot01,
    shotAlt: "Organisations console with the list of organisations and a New Organisation button.",
    steps: [
      { caption: "This is your organisations console.", action: "reveal", hotspot: { x: 5, y: 20, w: 90, h: 50 } },
      { caption: "Click 'New Organisation' to start one.", action: "highlight", hotspot: { x: 78, y: 18, w: 18, h: 8 } },
      { caption: "Open the create form.", action: "click", hotspot: { x: 87, y: 22, w: 8, h: 5 } },
      { caption: "Organisation ready.", action: "toast", text: "Organisation created", hotspot: { x: 70, y: 85, w: 25, h: 10 } },
    ],
  },
  {
    id: "m2",
    number: 2,
    title: "Invite your first team members",
    why: "Nothing works alone — invite your project manager and subcontractors so they can log in.",
    deepLink: "/org",
    ifWrong: "If invites bounce, double-check the email address for typos.",
    shot: shot02,
    shotAlt: "New organisation form with fields for name and invite emails.",
    steps: [
      { caption: "Give the organisation a name.", action: "highlight", hotspot: { x: 10, y: 30, w: 55, h: 8 } },
      { caption: "Add an invite email.", action: "type", text: "pm@site.com", hotspot: { x: 10, y: 55, w: 55, h: 8 } },
      { caption: "Pick their role.", action: "highlight", hotspot: { x: 68, y: 55, w: 25, h: 8 } },
      { caption: "Send invites and create.", action: "click", hotspot: { x: 40, y: 80, w: 20, h: 8 } },
      { caption: "Invite sent.", action: "toast", text: "Invite sent", hotspot: { x: 70, y: 85, w: 25, h: 10 } },
    ],
  },
  {
    id: "m3",
    number: 3,
    title: "Create your first project",
    why: "A project is one job site. Everything from drawings to diaries hangs off it.",
    deepLink: "/projects/new",
    ifWrong: "If the site address won't save, check you filled in every required field.",
    shot: shot05,
    shotAlt: "New project form with project name and site address fields.",
    steps: [
      { caption: "Name the project.", action: "type", text: "Willow Bank House", hotspot: { x: 10, y: 30, w: 55, h: 8 } },
      { caption: "Enter the site address.", action: "type", text: "12 Willow Lane", hotspot: { x: 10, y: 48, w: 55, h: 8 } },
      { caption: "Click 'Create Project'.", action: "highlight", hotspot: { x: 40, y: 82, w: 22, h: 8 } },
      { caption: "Project ready.", action: "toast", text: "Project ready", hotspot: { x: 70, y: 85, w: 25, h: 10 } },
    ],
  },
  {
    id: "m4",
    number: 4,
    title: "Upload to the Project Bible",
    why: "The Project Bible is one place for every document. Drop files in and the whole team sees them.",
    deepLink: "/projects",
    ifWrong: "If a file won't upload, it may be too big — try under 50MB.",
    shot: shot11,
    shotAlt: "Project Bible showing search bar, category filters and document cards.",
    steps: [
      { caption: "This is the Project Bible — every document, one place.", action: "reveal", hotspot: { x: 5, y: 15, w: 90, h: 25 } },
      { caption: "Search across everything.", action: "highlight", hotspot: { x: 5, y: 30, w: 45, h: 8 } },
      { caption: "Filter by document type.", action: "highlight", hotspot: { x: 52, y: 30, w: 45, h: 8 } },
      { caption: "Open a document to view it.", action: "click", hotspot: { x: 6, y: 88, w: 22, h: 8 } },
      { caption: "Document opened.", action: "toast", text: "Document opened", hotspot: { x: 70, y: 85, w: 25, h: 10 } },
    ],
  },
  {
    id: "m5",
    number: 5,
    title: "Add a GA drawing",
    why: "The drawing is the map you'll pin work onto every day. No drawing, no pins.",
    deepLink: "/projects",
    ifWrong: "If the drawing won't display, re-upload as a PDF.",
    shot: shot09,
    shotAlt: "Active project drawings panel with a sheet dropdown and Add to DABS button.",
    steps: [
      { caption: "Pick the sheet you're working from.", action: "highlight", hotspot: { x: 6, y: 40, w: 78, h: 10 } },
      { caption: "Add it into DABS so crews can pin against it.", action: "highlight", hotspot: { x: 82, y: 40, w: 12, h: 10 } },
      { caption: "Confirm.", action: "click", hotspot: { x: 87, y: 44, w: 6, h: 6 } },
      { caption: "Sheet added to DABS.", action: "toast", text: "Added to DABS", hotspot: { x: 70, y: 85, w: 25, h: 10 } },
    ],
  },
  {
    id: "m6",
    number: 6,
    title: "Publish today's DABS",
    why: "The DABS tells every crew what they're doing today, in one glance.",
    deepLink: "/projects",
    ifWrong: "If no zones show, add zones to your drawing first.",
    shot: shot12,
    shotAlt: "DABS Spatial Pin Drop screen with Work Zone and Trade Package selectors.",
    steps: [
      { caption: "This is DABS — Spatial Pin Drop.", action: "reveal", hotspot: { x: 5, y: 15, w: 90, h: 25 } },
      { caption: "Choose the work zone.", action: "highlight", hotspot: { x: 6, y: 50, w: 45, h: 10 } },
      { caption: "Choose the trade package.", action: "type", text: "Electrical First Fix", hotspot: { x: 52, y: 50, w: 44, h: 10 } },
      { caption: "Open the active drawing.", action: "click", hotspot: { x: 6, y: 75, w: 78, h: 10 } },
    ],
  },
  {
    id: "m7",
    number: 7,
    title: "Drop a live pin",
    why: "A pin shows exactly where a crew is on the drawing right now. Colour = which trade.",
    deepLink: "/projects",
    ifWrong: "If the pin doesn't stick, tap the drawing first to focus it.",
    shot: shot13,
    shotAlt: "GA drawing with a labour pin and the active shifts panel below.",
    steps: [
      { caption: "Tap where the crew is working to drop a pin.", action: "click", hotspot: { x: 45, y: 5, w: 8, h: 10 } },
      { caption: "Lock it to the Oracle so it can reason about it.", action: "highlight", hotspot: { x: 74, y: 46, w: 14, h: 8 } },
      { caption: "Pin logged. It appears in Active Shifts.", action: "highlight", hotspot: { x: 8, y: 65, w: 84, h: 20 } },
    ],
  },
  {
    id: "m8",
    number: 8,
    title: "Log today in the Daily Diary",
    why: "Two minutes today saves two hours in a dispute later.",
    deepLink: "/projects",
    ifWrong: "If save fails, check you have an internet connection.",
    shot: shot13,
    shotAlt: "Close-out button for today's shift and the daily diary flow.",
    steps: [
      { caption: "At end of day, close out the shift.", action: "highlight", hotspot: { x: 8, y: 78, w: 84, h: 8 } },
      { caption: "This opens the daily diary.", action: "click", hotspot: { x: 40, y: 80, w: 20, h: 6 } },
      { caption: "Diary saved for today.", action: "toast", text: "Diary entry saved", hotspot: { x: 70, y: 85, w: 25, h: 10 } },
    ],
  },
  {
    id: "m9",
    number: 9,
    title: "Report a snag",
    why: "Snap a photo of anything wrong and the Snag Master writes the fix-list for you.",
    deepLink: "/snags",
    ifWrong: "If AI analysis stalls, try a smaller, clearer photo.",
    shot: shot16,
    shotAlt: "Snag Master defect intelligence screen with New Snag button and status filters.",
    steps: [
      { caption: "This is Snag Master — defect intelligence.", action: "reveal", hotspot: { x: 5, y: 15, w: 90, h: 30 } },
      { caption: "Start a new snag.", action: "highlight", hotspot: { x: 78, y: 30, w: 18, h: 10 } },
      { caption: "Or add your very first from here.", action: "click", hotspot: { x: 42, y: 82, w: 18, h: 8 } },
      { caption: "Snap the defect and the Foreman writes it up.", action: "wait", hotspot: { x: 42, y: 82, w: 18, h: 8 } },
    ],
  },
  {
    id: "m10",
    number: 10,
    title: "Ask the Oracle",
    why: "The Oracle is your 30-year site mentor. Ask a plain question, get a plain answer.",
    deepLink: "/tooling",
    ifWrong: "If no answer comes, refresh and ask again — sessions can time out.",
    shot: shot17,
    shotAlt: "The Oracle terminal with Scan, Upload and View buttons and a note input.",
    steps: [
      { caption: "The Oracle is ready for input.", action: "reveal", hotspot: { x: 12, y: 18, w: 78, h: 45 } },
      { caption: "Attach a photo, drawing or PDF.", action: "highlight", hotspot: { x: 40, y: 55, w: 20, h: 20 } },
      { caption: "Or just type a note.", action: "type", text: "Soleplate reads 12mm low on B/3", hotspot: { x: 14, y: 80, w: 74, h: 12 } },
      { caption: "The Oracle replies with a plain-English answer.", action: "wait", hotspot: { x: 14, y: 80, w: 74, h: 12 } },
    ],
  },
];
