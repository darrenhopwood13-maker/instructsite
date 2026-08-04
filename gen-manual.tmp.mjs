import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";

const A4 = [595.28, 841.89];
const M = 56;
const ACCENT = rgb(0.92, 0.35, 0.13);
const INK = rgb(0.09, 0.10, 0.12);
const MUTED = rgb(0.42, 0.45, 0.50);
const RULE = rgb(0.85, 0.87, 0.90);

const doc = await PDFDocument.create();
doc.setTitle("instructSite — Complete Onboarding Manual");
doc.setAuthor("instructSite");
doc.setSubject("Onboarding and operations manual");

const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const obl = await doc.embedFont(StandardFonts.HelveticaOblique);

let page, y;
const pages = [];
const toc = [];

function newPage() {
  page = doc.addPage(A4);
  pages.push(page);
  y = A4[1] - M;
  return page;
}

function wrap(text, font, size, width) {
  const out = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > width) {
        if (line) out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

function space(n) {
  y -= n;
  if (y < M + 40) newPage();
}

function text(str, { font = reg, size = 10.5, color = INK, indent = 0, lead = 14.5 } = {}) {
  const width = A4[0] - M * 2 - indent;
  for (const line of wrap(str, font, size, width)) {
    if (y < M + 30) newPage();
    page.drawText(line, { x: M + indent, y, size, font, color });
    y -= lead;
  }
}

function h1(num, title) {
  if (y < M + 160) newPage();
  else space(16);
  toc.push({ num, title, page: pages.length });
  page.drawRectangle({ x: M, y: y - 4, width: 4, height: 22, color: ACCENT });
  const label = (num ? `${num}.  ${title}` : title).toUpperCase();
  const maxW = A4[0] - M * 2 - 14;
  let hs = 15;
  while (hs > 10 && bold.widthOfTextAtSize(label, hs) > maxW) hs -= 0.5;
  page.drawText(label, { x: M + 14, y, size: hs, font: bold, color: INK });
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.75, color: RULE });
  y -= 20;
}

function h2(title) {
  space(8);
  if (y < M + 60) newPage();
  page.drawText(title, { x: M, y, size: 11, font: bold, color: ACCENT });
  y -= 16;
}

function bullet(label, body) {
  const size = 10.5;
  const indent = 16;
  const width = A4[0] - M * 2 - indent;
  const head = label ? `${label}: ` : "";
  const headW = bold.widthOfTextAtSize(head, size);
  // build lines manually so the label can be bold on the first line
  const firstWidth = width - headW;
  const words = String(body).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  let avail = firstWidth;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (reg.widthOfTextAtSize(t, size) > avail) {
      lines.push(line);
      line = w;
      avail = width;
    } else line = t;
  }
  lines.push(line);
  lines.forEach((ln, i) => {
    if (y < M + 30) newPage();
    if (i === 0) {
      page.drawText("•", { x: M + 4, y, size, font: reg, color: ACCENT });
      if (head) page.drawText(head, { x: M + indent, y, size, font: bold, color: INK });
      page.drawText(ln, { x: M + indent + headW, y, size, font: reg, color: INK });
    } else {
      page.drawText(ln, { x: M + indent, y, size, font: reg, color: INK });
    }
    y -= 14.5;
  });
  y -= 2;
}

function callout(title, body) {
  const size = 10;
  const indent = 14;
  const width = A4[0] - M * 2 - indent * 2;
  const lines = wrap(body, reg, size, width);
  const h = 22 + lines.length * 13.5;
  if (y - h < M + 20) newPage();
  page.drawRectangle({
    x: M, y: y - h + 10, width: A4[0] - M * 2, height: h,
    color: rgb(0.97, 0.96, 0.94), borderColor: RULE, borderWidth: 0.5,
  });
  page.drawRectangle({ x: M, y: y - h + 10, width: 3, height: h, color: ACCENT });
  let ty = y;
  page.drawText(title.toUpperCase(), { x: M + indent, y: ty, size: 8.5, font: bold, color: ACCENT });
  ty -= 14;
  for (const ln of lines) {
    page.drawText(ln, { x: M + indent, y: ty, size, font: reg, color: INK });
    ty -= 13.5;
  }
  y = y - h - 8;
}

/* ---------------- Cover ---------------- */
newPage();
page.drawRectangle({ x: 0, y: A4[1] - 300, width: A4[0], height: 300, color: rgb(0.07, 0.08, 0.10) });
page.drawRectangle({ x: 0, y: A4[1] - 306, width: A4[0], height: 6, color: ACCENT });
page.drawText("INSTRUCTSITE", { x: M, y: A4[1] - 150, size: 40, font: bold, color: rgb(1, 1, 1) });
page.drawText("COMPLETE ONBOARDING MANUAL", { x: M, y: A4[1] - 185, size: 14, font: reg, color: ACCENT });
page.drawText("Roles, documents, programmes, live site operations and compliance", {
  x: M, y: A4[1] - 232, size: 11, font: reg, color: rgb(0.75, 0.77, 0.80),
});
y = A4[1] - 380;
text("This manual explains how instructSite works end to end — who can do what, where each workflow lives, and how the pieces fit together from first signup to live site operations and compliance.", { size: 11.5, lead: 17 });
space(10);
text("Everything described here reflects the current product, including permits and NCRs, programme variance, short-term programmes, subcontractor PM seats, and the activity library.", { size: 11.5, lead: 17, color: MUTED });
const issued = new Date().toISOString().slice(0, 10);
page.drawText(`Issued ${issued}`, { x: M, y: M + 20, size: 9.5, font: bold, color: MUTED });
page.drawText("instructsite.com", { x: A4[0] - M - reg.widthOfTextAtSize("instructsite.com", 9.5), y: M + 20, size: 9.5, font: reg, color: MUTED });

/* ---------------- TOC placeholder ---------------- */
const tocPage = doc.addPage(A4);
pages.push(tocPage);

/* ---------------- Content ---------------- */
newPage();

h1(null, "Roles at a glance");
bullet("Master Admin (Founder)", "Owns the org and sees every project. Automatic — the first person to sign up under the company.");
bullet("Project Admin", "Runs a specific project day to day, uploads documents, manages invites. Invited by a master admin or another project admin.");
bullet("Site Manager", "Approves diaries, issues and closes permits, manages daily operation. Invited to a specific project.");
bullet("QS", "Verifies claimed progress against evidence. Invited to a specific project.");
bullet("Subcontractor", "Drops DABS pins and submits diary entries for their package. Accepts a company-level invite link or QR code.");
bullet("Subcontractor PM", "The one person per subcontractor company who can sign off permits and short-term programmes on the company's behalf. Designated by a site manager or project admin from among that company's accepted users.");
space(4);
callout("Scope of roles", "A person can hold different roles on different projects — role is project-scoped, not account-wide. The exception is Master Admin, which is company-wide.");

h1(1, "Getting Started");
text("The very first person to sign up for a company automatically becomes Master Admin.");
space(6);
text("To start a new project: choose New Project, name it and set the address. You automatically become that project's Project Admin.");

h1(2, "Building the Team");
h2("Inviting Project Admin, Site Manager and QS");
text("From the project's team panel, invite by email. They receive a real tracked invite, sign up or sign in, and are attached to the project with the correct role.");
h2("Registering a subcontractor");
text("Use Add Subcontractor, enter the company name and trade package(s). This generates an invite link and a QR code.");
h2("Accepting an invite");
text("Whoever accepts is attached with an admin seat by default.");
h2("Designating the PM seat");
text("An admin seat lets someone use the app day to day. Signing a permit or a short-term programme on the company's behalf requires the dedicated PM seat, designated by a site manager or project admin. This is deliberately stricter, because these are formal company sign-offs.");

h1(3, "Documents & The Project Bible");
text("Every document uploaded — drawings, RAMS, logistics plans, programmes — is automatically filed in the Project Bible.");
space(6);
bullet("Drawings", "Upload a PDF; each page is treated as a sheet. AI extracts the drawing number, revision, title, level and the zones shown. Zones are auto-created from this.");
bullet("Logistics Plan", "Uploaded separately and kept as its own zone set — site-wide things such as welfare and laydown areas, not tied to one floor.");
bullet("RAMS", "Uploaded per subcontractor and filed against their company. Should cover PPE, method statement, risk matrix and emergency procedures.");
bullet("Master Programme", "PDF or CSV supported. CSV is more reliable where you have the choice — it preserves task dependencies precisely.");

h1(4, "Zones, Packages & the Activity Library");
text("Zones are physical areas — floors, rooms, site areas. They are auto-created from drawings and logistics plans, or added manually.");
space(6);
text("Packages are trade divisions of work. Once a programme exists, every place that tags work — DABS, diaries, invites — offers a picker of the project's real packages instead of free text.");
space(6);
text("The Activity Library works one level down, for the individual activity descriptions used in the short-term programme AI builder. It has two tiers:");
space(4);
bullet("Project level", "Anything typed saves instantly, with full detail allowed.");
bullet("Org-wide shared library", "Generic reusable activity types only. Project-specific detail is filtered out automatically, and promotion into the shared library is always opt-in.");

h1(5, "Programme — Import, Progress & Short-Term Programmes");
text("The master programme drives the Programme vs Site panel on the site manager's diary. It shows each package's status (on track, behind or ahead), days variance, verified percentage against planned percentage, and an AI plain-English note.");
space(6);
text("Short-Term Programmes cover work that is not in the master programme — a subcontractor added mid-project, or out-of-scope extra work. There are two kinds:");
space(6);
h2("Shared (agreed)");
text("Built by upload or with the AI Builder, and editable by either party while it is a draft. It locks once both the site manager and the subcontractor PM accept — after that it is annotation only (status and comments, no re-editing). A maximum of 5 accepted programmes per subcontractor per project. Filed to the Project Bible once accepted.");
h2("Private (personal)");
text("Either party can create one for their own reference: manual entry, no sign-off, no lock, visible only to its creator. It does not count toward the cap and is not filed to the Project Bible.");

h1(6, "Live Site Operations");
bullet("DABS (Daily Activity Briefing System)", "Drop a pin on a zone, pick the package and add notes — speech-to-text is available for hands-free use. Checking out auto-generates a diary entry.");
bullet("The Site Manager's Diary", "Daily activity rolls up for review and verification. Verified entries feed the Programme vs Site variance panel.");
bullet("QS Verification", "Claimed progress is reviewed against photo evidence before it counts as verified.");

h1(7, "Compliance — Permits & NCRs");
h2("Permits");
text("Permits are issued for higher-risk activities, which are auto-flagged. They must be explicitly closed out by the subcontractor with evidence. If a shift ends without close-out, both the subcontractor and the site manager are notified. The site manager can always close a permit themselves, but doing so sends a warning notification to the subcontractor.");
h2("NCRs");
text("Three forced closures for the same subcontractor automatically raise a formal Non-Conformance Report against that company, per project.");

h1(8, "Oracle — the AI Site Assistant");
text("Oracle is a project-scoped AI assistant that has read every drawing, RAMS and document on that specific project. It never answers using another project's data, and its answers are cited.");

h1(9, "Director's Dashboard");
text("A portfolio-level view across every project the master admin has access to.");

h1("A", "Appendix A — Tips & Hints");
bullet("Testing with one inbox (Gmail plus-addressing)", "Gmail and many other providers ignore everything after a \"+\" in the address for delivery, so you+projectadmin@gmail.com, you+sitemanager@gmail.com and so on all land in one real inbox while instructSite treats each as a genuinely distinct account. Useful for setting up or testing a full team without needing separate real inboxes.");
bullet("CSV over PDF for programmes", "Where you have the choice, CSV preserves dependencies precisely, imports faster, and needs no AI extraction step.");

h1("B", "Appendix B — Quick Role / Permission Reference");
const rows = [
  ["Admin seat (subcontractor)", "Day-to-day app use, pins, diary entries."],
  ["PM seat (subcontractor)", "The one person who can sign permits and short-term programmes for the company. Designated, not automatic."],
  ["Site Manager", "Issues and closes permits, approves diaries."],
  ["QS", "Verifies progress against evidence."],
  ["Project Admin", "Full project management."],
  ["Master Admin", "Company-wide, every project."],
];
const colX = M + 170;
for (const [k, v] of rows) {
  const lines = wrap(v, reg, 10, A4[0] - M - colX);
  const h = Math.max(lines.length * 13.5, 16) + 8;
  if (y - h < M + 20) newPage();
  page.drawLine({ start: { x: M, y: y + 12 }, end: { x: A4[0] - M, y: y + 12 }, thickness: 0.5, color: RULE });
  for (const kl of wrap(k, bold, 10, colX - M - 12)) {
    page.drawText(kl, { x: M, y, size: 10, font: bold, color: INK });
    y -= 13.5;
  }
  let vy = y + (wrap(k, bold, 10, colX - M - 12).length) * 13.5;
  for (const ln of lines) {
    page.drawText(ln, { x: colX, y: vy, size: 10, font: reg, color: INK });
    vy -= 13.5;
  }
  y = Math.min(y, vy) - 8;
}

/* ---------------- TOC ---------------- */
{
  const p = tocPage;
  let ty = A4[1] - M;
  p.drawText("CONTENTS", { x: M, y: ty, size: 20, font: bold, color: INK });
  ty -= 10;
  p.drawLine({ start: { x: M, y: ty }, end: { x: A4[0] - M, y: ty }, thickness: 1.5, color: ACCENT });
  ty -= 30;
  for (const e of toc) {
    const label = e.num ? `${e.num}.  ${e.title}` : e.title;
    const num = String(e.page);
    p.drawText(label, { x: M, y: ty, size: 11, font: bold, color: INK });
    const lw = bold.widthOfTextAtSize(label, 11);
    const nw = reg.widthOfTextAtSize(num, 11);
    const dotsStart = M + lw + 8;
    const dotsEnd = A4[0] - M - nw - 8;
    if (dotsEnd > dotsStart) {
      p.drawLine({
        start: { x: dotsStart, y: ty + 3 }, end: { x: dotsEnd, y: ty + 3 },
        thickness: 0.5, color: RULE, dashArray: [1, 3],
      });
    }
    p.drawText(num, { x: A4[0] - M - nw, y: ty, size: 11, font: reg, color: MUTED });
    ty -= 24;
  }
}

/* ---------------- Footers ---------------- */
pages.forEach((p, i) => {
  if (i === 0) return;
  p.drawLine({ start: { x: M, y: M - 12 }, end: { x: A4[0] - M, y: M - 12 }, thickness: 0.5, color: RULE });
  p.drawText("instructSite — Complete Onboarding Manual", { x: M, y: M - 26, size: 8, font: reg, color: MUTED });
  const n = String(i + 1);
  p.drawText(n, { x: A4[0] - M - reg.widthOfTextAtSize(n, 8), y: M - 26, size: 8, font: bold, color: MUTED });
});

fs.writeFileSync("/tmp/manual/instructSite-manual.pdf", await doc.save());
console.log("pages:", pages.length);
