import type { GuideStep } from "./GuideDemo";
import type { ReactNode } from "react";

export interface Mission {
  id: string;
  number: number;
  title: string;
  why: string;
  deepLink: string;
  ifWrong: string;
  steps: GuideStep[];
  mockKey: MockKey;
}

export type MockKey =
  | "org"
  | "invite"
  | "project"
  | "bible"
  | "drawing"
  | "dabs"
  | "pins"
  | "diary"
  | "snags"
  | "oracle";

export const MISSIONS: Mission[] = [
  {
    id: "m1",
    number: 1,
    title: "Create your organisation",
    why: "Everything in instructSite lives inside your organisation. Set it up once and your whole team joins in.",
    deepLink: "/org/new",
    ifWrong: "If the CREATE button is greyed out, fill in the name field first.",
    mockKey: "org",
    steps: [
      { caption: "Click 'New Organisation'", action: "click", target: "newOrg" },
      { caption: "Type your company name", action: "type", target: "orgName", text: "Hopwood Construction" },
      { caption: "Click 'Create'", action: "click", target: "createOrg" },
      { caption: "Your organisation is ready", action: "toast", text: "Organisation created" },
    ],
  },
  {
    id: "m2",
    number: 2,
    title: "Invite your first team members",
    why: "Nothing works alone — invite your project manager and subcontractors so they can log in.",
    deepLink: "/org",
    ifWrong: "If invites bounce, double-check the email address for typos.",
    mockKey: "invite",
    steps: [
      { caption: "Click 'Invite Member'", action: "click", target: "inviteBtn" },
      { caption: "Type their email", action: "type", target: "email", text: "pm@site.com" },
      { caption: "Pick their role", action: "click", target: "role" },
      { caption: "Send the invite", action: "click", target: "send" },
      { caption: "Invite sent", action: "toast", text: "Invite sent" },
    ],
  },
  {
    id: "m3",
    number: 3,
    title: "Create your first project",
    why: "A project is one job site. Everything from drawings to diaries hangs off it.",
    deepLink: "/projects/new",
    ifWrong: "If the site address won't save, check you filled in every required field.",
    mockKey: "project",
    steps: [
      { caption: "Click 'New Project'", action: "click", target: "newProj" },
      { caption: "Name the project", action: "type", target: "projName", text: "Willow Bank House" },
      { caption: "Enter the site address", action: "type", target: "addr", text: "12 Willow Lane" },
      { caption: "Click 'Create'", action: "click", target: "createProj" },
      { caption: "Project created", action: "toast", text: "Project ready" },
    ],
  },
  {
    id: "m4",
    number: 4,
    title: "Upload to the Project Bible",
    why: "The Project Bible is one place for every document. Drop files in and the whole team sees them.",
    deepLink: "/projects",
    ifWrong: "If a file won't upload, it may be too big — try under 50MB.",
    mockKey: "bible",
    steps: [
      { caption: "Open Project Bible", action: "click", target: "openBible" },
      { caption: "Drop a PDF into the drop zone", action: "drop", target: "drop" },
      { caption: "File is added", action: "appear", target: "row" },
      { caption: "Uploaded", action: "toast", text: "Document added" },
    ],
  },
  {
    id: "m5",
    number: 5,
    title: "Add a GA drawing",
    why: "The drawing is the map you'll pin work onto every day. No drawing, no pins.",
    deepLink: "/projects",
    ifWrong: "If the drawing won't display, re-upload as a PDF.",
    mockKey: "drawing",
    steps: [
      { caption: "Open Drawings", action: "click", target: "drawings" },
      { caption: "Drop your GA drawing", action: "drop", target: "drop" },
      { caption: "Drawing appears", action: "appear", target: "thumb" },
    ],
  },
  {
    id: "m6",
    number: 6,
    title: "Publish today's DABS",
    why: "The DABS tells every crew what they're doing today, in one glance.",
    deepLink: "/projects",
    ifWrong: "If no zones show, add zones to your drawing first.",
    mockKey: "dabs",
    steps: [
      { caption: "Open DABS", action: "click", target: "openDabs" },
      { caption: "Assign a crew to a zone", action: "click", target: "zone" },
      { caption: "Publish DABS", action: "click", target: "publish" },
      { caption: "Crews notified", action: "toast", text: "DABS published" },
    ],
  },
  {
    id: "m7",
    number: 7,
    title: "Drop a live pin",
    why: "A pin shows exactly where a crew is on the drawing right now. Colour = which trade.",
    deepLink: "/projects",
    ifWrong: "If the pin doesn't stick, tap the drawing first to focus it.",
    mockKey: "pins",
    steps: [
      { caption: "Tap the drawing", action: "click", target: "canvas" },
      { caption: "Pick the trade", action: "click", target: "trade" },
      { caption: "Pin is placed", action: "appear", target: "pin" },
    ],
  },
  {
    id: "m8",
    number: 8,
    title: "Log today in the Daily Diary",
    why: "Two minutes today saves two hours in a dispute later.",
    deepLink: "/projects",
    ifWrong: "If save fails, check you have an internet connection.",
    mockKey: "diary",
    steps: [
      { caption: "Open Daily Diary", action: "click", target: "openDiary" },
      { caption: "Note the weather and crews on site", action: "type", target: "note", text: "Dry, 8 crews on site" },
      { caption: "Save", action: "click", target: "save" },
      { caption: "Diary saved", action: "toast", text: "Diary entry saved" },
    ],
  },
  {
    id: "m9",
    number: 9,
    title: "Report a snag",
    why: "Snap a photo of anything wrong and the Snag Master writes the fix-list for you.",
    deepLink: "/snags",
    ifWrong: "If AI analysis stalls, try a smaller, clearer photo.",
    mockKey: "snags",
    steps: [
      { caption: "Click 'New Snag'", action: "click", target: "newSnag" },
      { caption: "Attach a photo", action: "drop", target: "drop" },
      { caption: "AI analyses the snag", action: "wait" },
      { caption: "Snag list ready", action: "appear", target: "result" },
    ],
  },
  {
    id: "m10",
    number: 10,
    title: "Ask the Oracle",
    why: "The Oracle is your 30-year site mentor. Ask a plain question, get a plain answer.",
    deepLink: "/tooling",
    ifWrong: "If no answer comes, refresh and ask again — sessions can time out.",
    mockKey: "oracle",
    steps: [
      { caption: "Click into the prompt", action: "click", target: "prompt" },
      { caption: "Ask a question", action: "type", target: "prompt", text: "What are today's high-risk activities?" },
      { caption: "Send", action: "click", target: "send" },
      { caption: "Oracle replies", action: "appear", target: "reply" },
    ],
  },
];

export type MissionMockRenderer = () => ReactNode;
