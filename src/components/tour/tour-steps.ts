/**
 * Live guided tour — step data.
 *
 * Unlike `src/components/guide/missions.tsx` (a replay over static
 * screenshots), these steps target REAL elements in the running app via
 * `data-tour` attributes. Copy is adapted from the missions script so the
 * two guides speak with the same voice.
 *
 * Scope for this pass: team invites → document upload → bible & zones.
 * DABS, permits and short-term programmes are deliberately out of scope.
 */

export interface TourStep {
  id: string;
  /** Concrete pathname this step happens on. */
  route: string;
  /** CSS selector for a real, live element. */
  target: string;
  title: string;
  body: string;
  /** What the person should actually do. The tour never clicks for them. */
  action: string;
}

/** The Kingsgate House demo project — fully populated with real data. */
export const DEMO_PROJECT_ID = "42c41402-07e7-4608-97a5-d792293f1573";

export function buildTourSteps(projectId: string): TourStep[] {
  const cockpit = `/projects/${projectId}`;
  return [
    {
      id: "portfolio",
      route: "/projects",
      target: '[data-tour="project-card"]',
      title: "Your portfolio of live jobs",
      body: "Every active job you're running shows up here. Each card is one site — drawings, crews, diaries and snags all hang off it.",
      action: "Click the project card to open the cockpit.",
    },
    {
      id: "team-section",
      route: cockpit,
      target: '[data-tour="team-section"]',
      title: "Project Administration",
      body: "This is where you build the team. Everyone who touches the job — admins, site managers, QS, subcontractors — is invited from this one block.",
      action: "Have a read, then press Next.",
    },
    {
      id: "invite-project-admin",
      route: cockpit,
      target: '[data-tour="invite-project-admin"]',
      title: "Invite your Project Admin",
      body: "Project Admins can run the whole job — invite people, upload documents, accept programmes. Add a second pair of hands here.",
      action: "Click this to invite your Project Admin.",
    },
    {
      id: "invite-site-manager",
      route: cockpit,
      target: '[data-tour="invite-site-manager"]',
      title: "Invite your Site Manager",
      body: "Site Managers run the day on the ground — pins, shifts and diaries. They can also be picked as a Package Manager further down.",
      action: "Click this to invite the Site Manager.",
    },
    {
      id: "invite-qs",
      route: cockpit,
      target: '[data-tour="invite-qs"]',
      title: "Invite your QS",
      body: "The Quantity Surveyor verifies diary claims, so what gets paid matches what was actually built.",
      action: "Click this to invite your QS.",
    },
    {
      id: "sub-company",
      route: cockpit,
      target: '[data-tour="sub-company"]',
      title: "Get your trades on the job",
      body: "No subs, no site. Start with the subcontractor's company name, then their contact email and the trade packages they cover.",
      action: "Type the subcontractor's company name.",
    },
    {
      id: "sub-generate",
      route: cockpit,
      target: '[data-tour="sub-generate"]',
      title: "Generate their access pack",
      body: "Hit generate and we build them their own login pack — a one-time link and a QR code you can hand out at the gate.",
      action: "Click Generate Subcontractor Access.",
    },
    {
      id: "sub-directory",
      route: cockpit,
      target: '[data-tour="sub-directory"]',
      title: "The trade directory",
      body: "Until they log in, a company sits in Invite Pending — chase them if they're slow. Once accepted, use Make PM to nominate the one person who signs off programmes for that company.",
      action: "Scan the directory, then press Next.",
    },
    {
      id: "upload-drawings",
      route: cockpit,
      target: '[data-tour="upload-drawings"]',
      title: "Load your drawings",
      body: "The drawing is the map you'll pin work onto every day. Drop the GA pack here and title blocks are read automatically into the Active Drawings dropdown.",
      action: "Drop your GA drawing pack into this panel.",
    },
    {
      id: "upload-logistics",
      route: cockpit,
      target: '[data-tour="upload-logistics"]',
      title: "Load the logistics plan",
      body: "Drop the site logistics plan in and the zones and levels are pulled straight out of it — no manual typing.",
      action: "Drop your logistics plan into this panel.",
    },
    {
      id: "upload-rams",
      route: cockpit,
      target: '[data-tour="upload-rams"]',
      title: "File the safety paperwork",
      body: "RAMS tell people how to work safely. Pick the trade package first, then drop the master RAMS file in — it's filed against that trade.",
      action: "Upload the RAMS for a trade package.",
    },
    {
      id: "zones",
      route: cockpit,
      target: '[data-tour="zones"]',
      title: "Your work zones",
      body: "These tiles are the work zones pulled out of your logistics plan — each one is a patch of the site that crews get assigned to.",
      action: "Click a zone to see what's in it.",
    },
    {
      id: "programme-upload",
      route: `/programme/${projectId}`,
      target: '[data-tour="programme-upload"]',
      title: "Let Randall read the programme",
      body: "Drop your programme in — PDF, CSV, XML or XER — and Randall pulls every task out and writes a plain-English playbook for each day.",
      action: "Click Upload Programme.",
    },
    {
      id: "bible-search",
      route: `/projects/${projectId}/bible`,
      title: "Everything in one place",
      target: '[data-tour="bible-search"]',
      body: "The Project Bible is your one shelf for every document on this job. Type any word — sheet number, trade, contractor — and it finds it.",
      action: "Search for a document.",
    },
    {
      id: "bible-filters",
      route: `/projects/${projectId}/bible`,
      target: '[data-tour="bible-filters"]',
      title: "Or filter by type",
      body: "Use the chips to narrow it down — drawings, RAMS, method statements, the lot. That's the onboarding loop complete.",
      action: "Pick a filter chip, then finish the tour.",
    },
  ];
}
