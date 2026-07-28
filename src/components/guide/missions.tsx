import type { ReactNode } from "react";
import type { GuideStep } from "./GuideDemo";

import shot01 from "@/assets/guide/guide-01-organisations.png.asset.json";
import shot02 from "@/assets/guide/guide-02-new-organisation.png.asset.json";
import shot03 from "@/assets/guide/guide-03-active-projects.png.asset.json";
import shot04 from "@/assets/guide/guide-04-new-project-ai-setup.png.asset.json";
import shot05 from "@/assets/guide/guide-05-new-project-fields.png.asset.json";
import shot06 from "@/assets/guide/guide-06-project-cockpit.png.asset.json";
import shot07 from "@/assets/guide/guide-07-subcontractor-directory.png.asset.json";
import shot08 from "@/assets/guide/guide-08-subcontractors-master-view.png.asset.json";
import shot09 from "@/assets/guide/guide-09-active-drawings.png.asset.json";
import shot10 from "@/assets/guide/guide-10-zones-and-rams.png.asset.json";
import shot11 from "@/assets/guide/guide-11-project-bible.png.asset.json";
import shot12 from "@/assets/guide/guide-12-dabs-pin-drop.png.asset.json";
import shot13 from "@/assets/guide/guide-13-dabs-shift-closeout.png.asset.json";
import shot14 from "@/assets/guide/guide-14-randall-programme-diary.png.asset.json";
import shot16 from "@/assets/guide/guide-16-snag-master.png.asset.json";
import shot17 from "@/assets/guide/guide-17-the-oracle.png.asset.json";

export interface Mission {
  id: string;
  number: number;
  title: string;
  why: ReactNode;
  /** Deep-link template. Use `{projectId}` where a real project id is needed;
   *  it is resolved at runtime in /start against the user's most recent
   *  project, falling back to `/projects` when none exists. */
  deepLink: string;
  ifWrong: string;
  steps: GuideStep[];
  shot: { url: string };
  shotAlt: string;
}

/* All hotspots are % of the framed screenshot ({x, y, w, h}). */

export const MISSIONS: Mission[] = [
  /* -------------------------------------------------------------------- M1 */
  {
    id: "m1",
    number: 1,
    title: "Set up your company",
    why: "Your company account holds everything — every job, every person, every drawing. Set it up once and the whole team joins in.",
    deepLink: "/org/new",
    ifWrong: "If the CREATE button is greyed out, fill in the organisation name first.",
    shot: shot01,
    shotAlt: "Founder console listing organisations with a New Organisation button.",
    steps: [
      {
        caption: "This is your company console.",
        narration: "Every job you run lives inside a company account.",
        action: "reveal",
        hotspot: { x: 5, y: 20, w: 90, h: 50 },
      },
      {
        caption: "Find the NEW ORGANISATION button, top right.",
        narration: "Top right, spot the New Organisation button.",
        action: "highlight",
        hotspot: { x: 75.1, y: 30.6, w: 17.2, h: 6.7 },
      },
      {
        caption: "Click it to open the form.",
        narration: "Give it a click to open the create form.",
        action: "click",
        hotspot: { x: 75.1, y: 30.6, w: 17.2, h: 6.7 },
      },
      {
        caption: "Type your company name.",
        narration: "Type your firm's name — the same one on your letterhead.",
        action: "type",
        text: "Ashcroft Homes Ltd",
        hotspot: { x: 23.2, y: 61.1, w: 52.3, h: 6.7 },
        shot: shot02,
      },
      {
        caption: "The slug auto-fills — leave it alone.",
        narration: "The slug is your web address. It fills itself in — no need to touch it.",
        action: "highlight",
        hotspot: { x: 23.2, y: 76.4, w: 52.3, h: 6.7 },
        shot: shot02,
      },
      {
        caption: "Company created.",
        narration: "That's your firm set up. Everyone else joins from here.",
        action: "toast",
        text: "Organisation created",
        hotspot: { x: 70, y: 85, w: 25, h: 10 },
        shot: shot02,
      },
    ],
  },

  /* -------------------------------------------------------------------- M2 */
  {
    id: "m2",
    number: 2,
    title: "Start your first project",
    why: "A project is one job site. Everything — drawings, crews, diaries, snags — hangs off it.",
    deepLink: "/projects/new",
    ifWrong: "If it won't save, check every required field has been filled in.",
    shot: shot03,
    shotAlt: "Portfolio view of active projects with a New Project button.",
    steps: [
      {
        caption: "This is your portfolio of live jobs.",
        narration: "Every active job you're running shows up here.",
        action: "reveal",
        hotspot: { x: 5, y: 20, w: 90, h: 45 },
      },
      {
        caption: "Find the NEW PROJECT button.",
        narration: "Top right, look for the New Project button.",
        action: "highlight",
        hotspot: { x: 78.6, y: 26.1, w: 13.8, h: 6.4 },
      },
      {
        caption: "Click to start a fresh job.",
        narration: "Give it a click to start a fresh job.",
        action: "click",
        hotspot: { x: 78.6, y: 26.1, w: 13.8, h: 6.4 },
      },
      {
        caption: "Drop a drawing pack for instant AI setup.",
        narration: <>Drag a drawing pack in here and <Term>the Oracle</Term> fills the fields for you.</>,
        action: "click",
        hotspot: { x: 23, y: 69, w: 52.9, h: 20.8 },
        shot: shot04,
      },
      {
        caption: "Pick which company owns the job.",
        narration: "Pick which of your companies this job belongs to.",
        action: "highlight",
        hotspot: { x: 23.2, y: 23.9, w: 52.3, h: 6.4 },
        shot: shot05,
      },
      {
        caption: "Name the project.",
        narration: "Type a short, memorable project name.",
        action: "type",
        text: "Willow Bank House",
        hotspot: { x: 23.2, y: 38.6, w: 52.3, h: 6.4 },
        shot: shot05,
      },
      {
        caption: "Enter the full site address.",
        narration: "Put the full site address in — postcode and all.",
        action: "type",
        text: "12 Willow Lane, York YO1 8AA",
        hotspot: { x: 23.2, y: 53.1, w: 52.3, h: 11.8 },
        shot: shot05,
      },
      {
        caption: "Add a short project brief.",
        narration: "A sentence or two on what you're building. That's the lot.",
        action: "highlight",
        hotspot: { x: 23.2, y: 88.5, w: 52.3, h: 11.5 },
        shot: shot05,
      },
    ],
  },

  /* -------------------------------------------------------------------- M3 */
  {
    id: "m3",
    number: 3,
    title: "Find your way around",
    why: "The project cockpit has four tools. Learn where they live and you'll never hunt for a button again.",
    deepLink: "/projects/{projectId}",
    ifWrong: "If a button is missing, your role probably doesn't have access — ask a founder to open it up.",
    shot: shot06,
    shotAlt: "Project cockpit with DABS, Randall, Site Manager and Settings buttons.",
    steps: [
      {
        caption: "DABS — today's plan on the drawing.",
        narration: <><Term>DABS</Term> is the daily briefing — one glance and every crew knows their job.</>,
        action: "highlight",
        hotspot: { x: 65.7, y: 25.5, w: 6.9, h: 8.8 },
      },
      {
        caption: "Randall Diary — the AI diary.",
        narration: <><Term>Randall</Term> reads your <Term>programme</Term> and writes the diary for you.</>,
        action: "highlight",
        hotspot: { x: 73.5, y: 25.5, w: 8.4, h: 8.8 },
      },
      {
        caption: "Site Manager — the command tower.",
        narration: "The Site Manager view is the live command tower — pins, shifts, everything.",
        action: "highlight",
        hotspot: { x: 82.9, y: 25.2, w: 9.4, h: 9.1 },
      },
      {
        caption: "Everything else lives in SETTINGS.",
        narration: "Every other tool — bible, snags, subs, oracle — lives inside the Settings menu.",
        action: "click",
        hotspot: { x: 83.5, y: 3.5, w: 8.8, h: 5.1 },
      },
    ],
  },

  /* -------------------------------------------------------------------- M4 */
  {
    id: "m4",
    number: 4,
    title: "Get your trades on the job",
    why: "No subs, no site. Add each company, tell us their trade, and we build them their own login pack.",
    deepLink: "/projects/{projectId}",
    ifWrong: "If the pack won't generate, double-check the company name and email are both filled in.",
    shot: shot07,
    shotAlt: "Subcontractor directory with company field, trade chips and access button.",
    steps: [
      {
        caption: "Type the subcontractor's company name.",
        narration: <>Start with the <Term>subcontractor</Term>'s company name.</>,
        action: "type",
        text: "Northern Sparks Ltd",
        hotspot: { x: 7.1, y: 37.5, w: 84.7, h: 4.8 },
      },
      {
        caption: "Tap the trade chip that fits.",
        narration: <>Pick the <Term>trade package</Term> chip that matches what they do.</>,
        action: "click",
        hotspot: { x: 7, y: 43.6, w: 77.2, h: 6.7 },
      },
      {
        caption: "Generate their access pack.",
        narration: "Hit generate and we build them their own login pack.",
        action: "click",
        hotspot: { x: 7.1, y: 51.3, w: 84.7, h: 4.3 },
      },
      {
        caption: "Invite sent.",
        narration: "That's them invited. Now watch the master view.",
        action: "toast",
        text: "Subcontractor pack ready",
        hotspot: { x: 70, y: 85, w: 25, h: 10 },
      },
      {
        caption: "See them sitting in INVITE PENDING.",
        narration: "Until they log in, they sit in Invite Pending — chase them if they're slow.",
        action: "highlight",
        hotspot: { x: 1.9, y: 42.6, w: 95, h: 24.4 },
        shot: shot08,
      },
      {
        caption: "OPEN PACK to see what they'll see.",
        narration: "Open Pack shows you exactly what the sub will see when they log in.",
        action: "highlight",
        hotspot: { x: 82.7, y: 51.5, w: 11.7, h: 6.7 },
        shot: shot08,
      },
    ],
  },

  /* -------------------------------------------------------------------- M5 */
  {
    id: "m5",
    number: 5,
    title: "Load your drawings",
    why: "The drawing is the map you'll pin work onto every day. No drawing, no pins, no plan.",
    deepLink: "/projects/{projectId}",
    ifWrong: "If a sheet won't display, re-export it from your CAD as a flat PDF and try again.",
    shot: shot09,
    shotAlt: "Active drawings panel with a sheet dropdown and Add to DABS button.",
    steps: [
      {
        caption: "Pick the sheet you're working from.",
        narration: <>Pick the <Term>GA drawing</Term> sheet you want the crews to work off today.</>,
        action: "highlight",
        hotspot: { x: 7.9, y: 16.8, w: 69.5, h: 5.6 },
      },
      {
        caption: "Push it into DABS.",
        narration: <>Push it into <Term>DABS</Term> so pins can go straight onto it.</>,
        action: "click",
        hotspot: { x: 77.9, y: 16.4, w: 9.3, h: 6.4 },
      },
      {
        caption: "Sheet is live on DABS.",
        narration: "Done — that sheet is now the drawing the whole site pins against.",
        action: "toast",
        text: "Added to DABS",
        hotspot: { x: 70, y: 85, w: 25, h: 10 },
      },
    ],
  },

  /* -------------------------------------------------------------------- M6 */
  {
    id: "m6",
    number: 6,
    title: "Zones and safety paperwork",
    why: "Zones tell people where to work. RAMS tell them how to work safely. You need both before a crew steps on.",
    deepLink: "/projects/{projectId}",
    ifWrong: "If the RAMS upload greys out, you haven't picked a trade package yet — pick one first.",
    shot: shot10,
    shotAlt: "Zone tiles on the left and a RAMS upload panel on the right.",
    steps: [
      {
        caption: "These tiles are your work zones.",
        narration: <>These tiles are the <Term>work zones</Term> — each one is a patch of the site.</>,
        action: "highlight",
        hotspot: { x: 8.8, y: 1.3, w: 38, h: 32.2 },
      },
      {
        caption: "Pick a trade before you upload.",
        narration: <>You need to pick a <Term>trade package</Term> first — that's what the warning is telling you.</>,
        action: "highlight",
        hotspot: { x: 53.9, y: 11, w: 35.2, h: 4.6 },
      },
      {
        caption: "Now drop the master RAMS in.",
        narration: <>Now drop the master <Term>RAMS</Term> file into the upload zone.</>,
        action: "click",
        hotspot: { x: 53.9, y: 16.1, w: 35.1, h: 26.8 },
      },
      {
        caption: "RAMS filed against the trade.",
        narration: "Filed. That trade is now cleared to start work in these zones.",
        action: "toast",
        text: "RAMS uploaded",
        hotspot: { x: 70, y: 85, w: 25, h: 10 },
      },
    ],
  },

  /* -------------------------------------------------------------------- M7 */
  {
    id: "m7",
    number: 7,
    title: "Everything in one place",
    why: "The Project Bible is your one shelf for every document on this job — searchable, filterable, always up to date.",
    deepLink: "/projects/{projectId}/bible",
    ifWrong: "If a doc is missing, someone forgot to upload it — nudge them, don't email it around.",
    shot: shot11,
    shotAlt: "Project Bible with a search bar, filter chips and document cards.",
    steps: [
      {
        caption: "Search across every document.",
        narration: "Type any word — sheet number, trade, contractor — and the bible finds it.",
        action: "type",
        text: "M&E first fix",
        hotspot: { x: 3.7, y: 31.1, w: 34.8, h: 5.4 },
      },
      {
        caption: "Or filter by document type.",
        narration: <>Or use the chips to narrow it down — drawings, <Term>RAMS</Term>, <Term>method statements</Term>, the lot.</>,
        action: "highlight",
        hotspot: { x: 39.2, y: 31.5, w: 56.1, h: 4.6 },
      },
    ],
  },

  /* -------------------------------------------------------------------- M8 */
  {
    id: "m8",
    number: 8,
    title: "Drop a pin and start a shift",
    why: "A pin is the crew's flag on the drawing. It says who's working, where, and on what — right now.",
    deepLink: "/dabs/{projectId}",
    ifWrong: "If the pin won't stick, tap the drawing itself first to give it focus, then try again.",
    shot: shot12,
    shotAlt: "DABS spatial pin drop with work zone and trade package selectors.",
    steps: [
      {
        caption: "Pick which work zone the crew's in.",
        narration: <>First pick the <Term>work zone</Term> the crew is heading to.</>,
        action: "highlight",
        hotspot: { x: 7.9, y: 57, w: 40.8, h: 5.9 },
      },
      {
        caption: "Then pick the trade package.",
        narration: <>Then pick the <Term>trade package</Term> so the pin gets the right colour.</>,
        action: "type",
        text: "Electrical First Fix",
        hotspot: { x: 50.1, y: 57, w: 40.8, h: 5.9 },
      },
      {
        caption: "Tap the drawing where they're working.",
        narration: <>Now tap the drawing right where the crew is standing — that drops the <Term>pin</Term>.</>,
        action: "click",
        hotspot: { x: 28.4, y: 0, w: 42.1, h: 42.9 },
        shot: shot13,
      },
      {
        caption: "Pin dropped, shift is live.",
        narration: <>Pin's in. Their <Term>shift</Term> is now live on the board.</>,
        action: "toast",
        text: "Pin dropped",
        hotspot: { x: 70, y: 85, w: 25, h: 10 },
        shot: shot13,
      },
    ],
  },

  /* -------------------------------------------------------------------- M9 */
  {
    id: "m9",
    number: 9,
    title: "Close out the shift",
    why: "Two minutes at the end of the day saves two hours in a dispute later. Close it out and the diary writes itself.",
    deepLink: "/dabs/{projectId}",
    ifWrong: "If close-out fails, check the internet — the app queues it and sends when you're back on.",
    shot: shot13,
    shotAlt: "Active shifts row with a close-out shift button and Ask Oracle link.",
    steps: [
      {
        caption: "Find today's active shifts row.",
        narration: <>Scroll to the active <Term>shifts</Term> row — the crews still on site.</>,
        action: "highlight",
        hotspot: { x: 7.9, y: 76.7, w: 83.2, h: 6.4 },
      },
      {
        caption: "Close out the shift.",
        narration: <>Hit Close Out and the <Term>daily diary</Term> pre-fills with what actually happened.</>,
        action: "click",
        hotspot: { x: 7.9, y: 76.7, w: 83.2, h: 6.4 },
      },
      {
        caption: "Diary saved for today.",
        narration: "Diary saved. Weather, hours and pins all logged.",
        action: "toast",
        text: "Diary entry saved",
        hotspot: { x: 70, y: 85, w: 25, h: 10 },
      },
      {
        caption: "Stuck? ASK ORACLE on this sheet.",
        narration: <>Stuck on anything on this drawing? Ask <Term>the Oracle</Term> right there.</>,
        action: "highlight",
        hotspot: { x: 82.9, y: 48, w: 7.4, h: 4 },
      },
    ],
  },

  /* -------------------------------------------------------------------- M10 */
  {
    id: "m10",
    number: 10,
    title: "Let the AI do the boring bits",
    why: "Programmes, snags, questions — hand the paperwork to Randall, Snag Master and the Oracle. They're quicker than you.",
    deepLink: "/programme/{projectId}",
    ifWrong: "If the AI hangs, refresh the page — sessions time out after a while of doing nothing.",
    shot: shot14,
    shotAlt: "Randall programme compiler with an upload button and compiled progress bar.",
    steps: [
      {
        caption: "Upload your programme PDF.",
        narration: <>Drop your <Term>programme</Term> in and <Term>Randall</Term> pulls every task out.</>,
        action: "click",
        hotspot: { x: 67, y: 61.7, w: 13.9, h: 8 },
      },
      {
        caption: "Watch it compile in seconds.",
        narration: "The bar fills as it reads — usually less than a minute.",
        action: "highlight",
        hotspot: { x: 18, y: 78.4, w: 62.8, h: 10.1 },
      },
      {
        caption: "Spotted a defect? NEW SNAG.",
        narration: <>Spotted a <Term>snag</Term> on site? Hit New Snag — Snag Master writes the fix-list for you.</>,
        action: "click",
        hotspot: { x: 79.8, y: 33, w: 12.5, h: 7 },
        shot: shot16,
      },
      {
        caption: "Or SCAN something into the Oracle.",
        narration: <>Or open <Term>the Oracle</Term> and Scan a photo, drawing or PDF straight in.</>,
        action: "highlight",
        hotspot: { x: 21.6, y: 56.3, w: 5.1, h: 9.7 },
        shot: shot17,
      },
      {
        caption: "And just type a plain question.",
        narration: "Or type a plain-English question. It replies in plain English.",
        action: "type",
        text: "What's the fire strategy for zone B?",
        hotspot: { x: 10.8, y: 77.5, w: 77.3, h: 11.5 },
        shot: shot17,
      },
    ],
  },
];
