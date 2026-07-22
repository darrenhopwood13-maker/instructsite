import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Download, BookOpen, Search, AlertTriangle, Lightbulb } from "lucide-react";
import pdfAsset from "@/assets/manual/instructSite-manual.pdf.asset.json";
import s01 from "@/assets/manual/01_dashboard.png.asset.json";
import s02 from "@/assets/manual/02_org_list.png.asset.json";
import s03 from "@/assets/manual/03_org_new.png.asset.json";
import s04 from "@/assets/manual/04_projects_list.png.asset.json";
import s05 from "@/assets/manual/05_projects_new.png.asset.json";
import s06 from "@/assets/manual/06_snags.png.asset.json";
import s07 from "@/assets/manual/07_tooling.png.asset.json";
import s10 from "@/assets/manual/10_home.png.asset.json";
import s11 from "@/assets/manual/11_project_detail.png.asset.json";
import s12 from "@/assets/manual/12_bible.png.asset.json";
import s13 from "@/assets/manual/13_dabs.png.asset.json";
import s14 from "@/assets/manual/14_programme.png.asset.json";
import s15 from "@/assets/manual/15_subpack.png.asset.json";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "Operator's Manual — instructSite" },
      {
        name: "description",
        content:
          "Fool-proof plain-English walkthrough of every instructSite workflow — organisations, projects, drawings, DABS, Randall's diary.",
      },
      { property: "og:title", content: "Operator's Manual — instructSite" },
      {
        property: "og:description",
        content: "Step-by-step manual for every instructSite feature.",
      },
    ],
  }),
  component: ManualPage,
});

type Section = {
  id: string;
  num: string;
  title: string;
  roles: string;
  content: ReactNode;
  searchText: string;
};

function ManualPage() {
  const [q, setQ] = useState("");
  const sections = useMemo(buildSections, []);
  const filtered = q.trim()
    ? sections.filter((s) =>
        (s.title + " " + s.searchText).toLowerCase().includes(q.toLowerCase()),
      )
    : sections;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              Operator's Manual
            </p>
            <h1
              className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              instructSite, end to end
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/60">
              Every workflow explained in plain English — WHO can do it, WHERE it lives, WHEN
              in the project lifecycle, and HOW step by step. Same content as the PDF, with
              deep links straight into each screen.
            </p>
          </div>
          <a
            href={pdfAsset.url}
            download="instructSite-manual.pdf"
            className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider"
          >
            <Download size={16} /> Download PDF
          </a>
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-6 md:self-start">
            <div className="glass-panel p-3">
              <label className="mb-2 flex items-center gap-2 rounded-md border border-white/15 bg-black/30 px-2 py-1.5">
                <Search size={14} className="text-foreground/50" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-transparent text-xs text-foreground outline-none"
                />
              </label>
              <ul className="space-y-1 text-xs">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block rounded px-2 py-1.5 uppercase tracking-widest text-foreground/70 hover:bg-white/5 hover:text-foreground"
                    >
                      <span className="text-alert">§{s.num}</span> {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="space-y-10">
            {filtered.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="glass-panel scroll-mt-24 p-6"
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.4em] text-alert">
                  Section {s.num} · {s.roles}
                </p>
                <h2
                  className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
                  style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
                >
                  {s.title}
                </h2>
                <div className="mt-4 h-[3px] w-16 rounded bg-alert" />
                <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/85">
                  {s.content}
                </div>
              </section>
            ))}
            {filtered.length === 0 && (
              <div className="glass-panel p-10 text-center text-sm text-foreground/60">
                No sections match "{q}".
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- reusable pieces ----

function Meta({
  who,
  where,
  when,
}: {
  who: ReactNode;
  where: ReactNode;
  when: ReactNode;
}) {
  const cell = "rounded-lg border border-white/10 bg-black/30 p-3";
  const label =
    "mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.3em] text-alert";
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className={cell}>
        <span className={label}>Who</span>
        <p className="text-xs text-foreground/85">{who}</p>
      </div>
      <div className={cell}>
        <span className={label}>Where</span>
        <p className="text-xs text-foreground/85">{where}</p>
      </div>
      <div className={cell}>
        <span className={label}>When</span>
        <p className="text-xs text-foreground/85">{when}</p>
      </div>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-alert text-[0.7rem] font-bold text-white">
            {i + 1}
          </span>
          <span className="pt-0.5">{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-400" />
      <div>
        <span className="mr-1 font-bold uppercase tracking-widest text-amber-300">
          Hint ·
        </span>
        {children}
      </div>
    </div>
  );
}

function Broken({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
      <div>
        <span className="mr-1 font-bold uppercase tracking-widest text-red-300">
          If it breaks ·
        </span>
        {children}
      </div>
    </div>
  );
}

function Fig({ src, caption }: { src: { url: string }; caption: string }) {
  return (
    <figure className="my-4 overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <img src={src.url} alt={caption} className="w-full" loading="lazy" />
      <figcaption className="px-3 py-2 text-[0.7rem] uppercase tracking-widest text-foreground/50">
        {caption}
      </figcaption>
    </figure>
  );
}

function K({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.75rem] text-foreground">
      {children}
    </code>
  );
}

// ---- content ----

function buildSections(): Section[] {
  return [
    {
      id: "big-picture",
      num: "1",
      title: "The Big Picture",
      roles: "Everyone",
      searchText:
        "roles founder org organisation project snag oracle nav bell tooling",
      content: (
        <>
          <p>
            instructSite is the AI command surface for construction projects. Everything you do
            lives inside one of four surfaces:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Organisation</b> — the tenant. Each customer company is a fully-isolated org.
              Founder-only creates them.
            </li>
            <li>
              <b>Project</b> — a job/site inside an org. Master Admins create projects. Members
              (PMs, Site Managers, QS, Subcontractors) live inside a project.
            </li>
            <li>
              <b>Snag Master</b> — the field module: scan a photo → AI writes a defect report →
              attach to the Project Bible.
            </li>
            <li>
              <b>AI Tooling / The Oracle</b> — the 30-year construction mentor. Ask questions,
              upload PDFs, capture photos, get referenced answers.
            </li>
          </ul>
          <p className="mt-2">
            <b>Top-nav map:</b> the <K>Organisation</K> button appears only for the Founder.
            Everyone else sees a <K>Projects</K> button in the same spot. The 🔔 bell pings
            when a new report is added to a Bible you belong to. <K>Snag Master</K> jumps to
            the defect module. Orange <K>AI Tooling</K> opens the Oracle cockpit. The{" "}
            <K>Project Bible</K> link appears only while you are inside a project.
          </p>
          <Fig src={s01} caption="Fig 1.1 · Director Portfolio (founder view)" />
          <Fig src={s10} caption="Fig 1.2 · Public landing page at /" />
          <Hint>
            The Founder never joins an org. Founder mode grants read-across to every org's
            projects and swaps the Projects button for the Organisation button.
          </Hint>
        </>
      ),
    },
    {
      id: "org-new",
      num: "2",
      title: "Setting up an Organisation",
      roles: "Founder only",
      searchText: "organisation create tenant silo slug invite founder",
      content: (
        <>
          <Meta
            who="Founder (owner role) only."
            where={
              <>
                Top nav → <Link to="/org" className="text-alert underline">Organisation</Link> →{" "}
                <Link to="/org/new" className="text-alert underline">+ New Organisation</Link>.
              </>
            }
            when="First step when onboarding a new customer company."
          />
          <p>
            Each org is a completely siloed tenant. Its projects, members, subcontractors,
            drawings, snags and reports are visible only to that org. Row-Level Security
            enforces this in the database — even a UI bug cannot cross-leak data.
          </p>
          <Fig src={s02} caption="Fig 2.1 · /org — every organisation you have created" />
          <Steps
            items={[
              <>
                Click <K>Organisation</K> in the top nav. You land on <K>/org</K>.
              </>,
              <>
                Click the orange <b>+ New Organisation</b> button.
              </>,
              <>
                Fill in <b>Organisation Name</b> (required). The <b>Slug</b> auto-generates —
                it appears in invite links, keep it short and lower-case.
              </>,
              <>
                Optional: Company Reg No., Primary Contact, Email, Phone, Address, Notes.
              </>,
              <>
                Fill the 3 <b>standard-seat</b> invite emails (see §3): 1 × PM, 2 × Subs. All
                optional — you can invite later from the edit page.
              </>,
              <>
                Hit <b>Create Organisation</b>. You are redirected to the org dashboard at{" "}
                <K>/org/&#123;id&#125;</K>.
              </>,
            ]}
          />
          <Fig src={s03} caption="Fig 2.2 · /org/new — the create-organisation form" />
          <Hint>
            The slug is used to build the invite link. If it's taken, the server appends a
            suffix. You can rename the org later; the slug is fixed.
          </Hint>
          <Broken>
            <b>Access denied — only the founder can create organisations.</b> You are signed in
            with the wrong account. Sign out and back in as the founder email.
          </Broken>
        </>
      ),
    },
    {
      id: "invites",
      num: "3",
      title: "Inviting people to an Organisation",
      roles: "Founder · Admin",
      searchText: "invite email magic link password accept seats pm subcontractor",
      content: (
        <>
          <Meta
            who="Founder invites into an org · Admin invites into a project."
            where={
              <>
                Org invites: <K>/org/&#123;id&#125;</K> · Project invites:{" "}
                <K>/projects/&#123;id&#125;</K>.
              </>
            }
            when="Immediately after creating the org, or any time you need to add a member."
          />
          <p>
            <b>The 3 standard seats.</b> Every org includes 1 PM (admin role) + 2 Subs. Enforced
            by a database trigger — you cannot exceed it without upgrading.
          </p>
          <p>
            <b>What the invitee sees:</b>
          </p>
          <Steps
            items={[
              <>They receive an email from <K>notify.instructsite.com</K> with a magic link.</>,
              <>Clicking opens <K>/reset-password</K> — they set a password.</>,
              <>Auto-redirect to <K>/join-org/invite/&#123;token&#125;</K> → <b>Accept invite</b>.</>,
              <>Land inside the org on <K>/projects</K> with their role active.</>,
            ]}
          />
          <Hint>
            If the invite email doesn't arrive, copy the link from the org edit page and send
            it manually. Magic links work for 24 hours.
          </Hint>
          <Broken>
            <b>Error: 'column reference org_id is ambiguous'.</b> Old bug — fixed. Refresh the
            invite link to regenerate the token.
          </Broken>
          <Broken>
            <b>Error: 'seat limit reached'.</b> Org already has 1 PM + 2 Subs. Remove a member
            from the edit page, or create a new org.
          </Broken>
        </>
      ),
    },
    {
      id: "project-new",
      num: "4",
      title: "Creating a Project & inviting Subcontractors",
      roles: "Master Admin · Project Admin",
      searchText: "project new create scope subcontractor invite trade",
      content: (
        <>
          <Meta
            who="Master Admin / Project Admin."
            where={
              <>
                Top nav → <Link to="/projects" className="text-alert underline">Projects</Link> →{" "}
                <Link to="/projects/new" className="text-alert underline">+ New Project</Link>.
              </>
            }
            when="Once the org exists and has at least one admin member."
          />
          <Steps
            items={[
              <>Open <K>/projects</K>. Click <b>+ New Project</b> (top-right).</>,
              <>Enter <b>Project Name</b>, <b>Site Address</b>, short <b>Scope Brief</b>.</>,
              <>Optional: pick a different Master Admin / Project Admin.</>,
              <>Click <b>Create</b>. You land on <K>/projects/&#123;id&#125;</K> — the cockpit.</>,
            ]}
          />
          <Fig src={s04} caption="Fig 4.1 · /projects — every project you can see" />
          <Fig src={s05} caption="Fig 4.2 · /projects/new — the create-project form" />
          <p className="mt-3 font-bold text-alert">Invite subcontractors to the project</p>
          <Steps
            items={[
              <>On <K>/projects/&#123;id&#125;</K>, scroll to the <b>Subcontractors</b> panel.</>,
              <>Click <b>+ Add Subcontractor</b>. Enter Company Name, Trade, Contact Email.</>,
              <>The sub gets an invite email → magic-link → password → project cockpit.</>,
              <>From then on, when they sign in they only see this project and their pack.</>,
            ]}
          />
          <Fig src={s11} caption="Fig 4.3 · /projects/{id} — project cockpit" />
          <Hint>
            Subs from other projects are never mixed in. Adding the same company to two
            projects creates two separate subcontractor records — one per project.
          </Hint>
        </>
      ),
    },
    {
      id: "scope-docs",
      num: "5",
      title: "Scope, Drawings, Logistics & RAMS",
      roles: "Admin · Site Manager upload · Anyone view",
      searchText: "scope drawings logistics rams pdf upload bible",
      content: (
        <>
          <Meta
            who="Upload: Master/Project Admin, Site Manager. View: any project member."
            where={<><K>/projects/&#123;id&#125;</K> — one panel per document type.</>}
            when="Drawings first (§6 depends on them), then Logistics, then RAMS."
          />
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Scope</b> — free-text field on the project (edit from the project header).
            </li>
            <li>
              <b>Drawings</b> — <b>Drawings</b> panel on the project. PDF or image (PNG/JPG),
              each with a title and revision.
            </li>
            <li>
              <b>Logistics Plans</b> — same panel, tagged as <i>logistics</i>.
            </li>
            <li>
              <b>RAMS</b> — the <b>Subcontractor Pack</b> at{" "}
              <K>/subcontractor-pack/&#123;id&#125;</K>. Each sub uploads their own with a
              valid-from date.
            </li>
          </ul>
          <Fig src={s15} caption="Fig 5.1 · /subcontractor-pack/{id} — master view" />
          <Fig src={s12} caption="Fig 5.2 · /projects/{id}/bible — every document, one hub" />
          <p>
            <b>How anything reaches the Project Bible.</b> Every file uploaded anywhere in the
            project (drawings, RAMS, weekly packs, Snag reports, Oracle reports) is
            automatically indexed into the Bible. When a new report is added, every project
            member receives a notification.
          </p>
          <Hint>
            Only Project Admins and Site Managers can upload. Subs upload their own compliance
            docs from their pack — they cannot touch drawings.
          </Hint>
          <Broken>
            <b>Upload stalls or fails.</b> compliance-docs has RLS. Confirm you're on the
            correct project and your role is admin or site_manager. Check file size &lt; 20 MB.
          </Broken>
        </>
      ),
    },
    {
      id: "dabs",
      num: "6",
      title: "Adding Drawings to DABS → Work Zones",
      roles: "Admin · Site Manager",
      searchText: "dabs work zones drawing polygon shift briefing daily",
      content: (
        <>
          <Meta
            who="Master Admin / Project Admin / Site Manager."
            where={<><K>/dabs/&#123;projectId&#125;</K> — the DABS workspace.</>}
            when="After drawings are uploaded (§5)."
          />
          <p>
            <b>Rule of the road.</b> No drawing may be added to a DABS workspace unless it
            already exists in the project's Drawings panel. This prevents rogue diagrams from
            being briefed to a crew.
          </p>
          <Steps
            items={[
              <>Open <K>/dabs/&#123;projectId&#125;</K>. Click <b>+ New Work Zone</b>.</>,
              <>Pick the <b>drawing</b> from the drop-down (only project drawings appear).</>,
              <>Draw the zone polygon directly on the drawing canvas.</>,
              <>Name the zone, set the shift (Day/Night), assign sub and trade.</>,
              <>Save. Zone appears on the Zone Matrix Board and in tomorrow's DABS.</>,
            ]}
          />
          <Fig src={s13} caption="Fig 6.1 · /dabs/{projectId} — DABS workspace" />
          <Hint>
            Zones you draw here become the workspaces subs check into every morning. Delete or
            rename them from the same page — updates are live.
          </Hint>
          <Broken>
            <b>The drawing drop-down is empty.</b> No drawings on the project yet — upload one
            from <K>/projects/&#123;id&#125;</K> first (§5).
          </Broken>
        </>
      ),
    },
    {
      id: "programme",
      num: "7",
      title: "Adding a Programme to Randall's Diary",
      roles: "Master Admin · Project Admin",
      searchText: "programme randall diary playbook asta p6 gantt pdf",
      content: (
        <>
          <Meta
            who="Master Admin / Project Admin."
            where={<><K>/programme/&#123;projectId&#125;</K> — Randall's Diary.</>}
            when="Once a construction programme (PDF) exists."
          />
          <p>
            <b>What Randall does.</b> Randall is the AI planner. Upload your programme PDF and
            Randall extracts a task schedule (name, start, finish, predecessors) and generates a
            day-by-day playbook.
          </p>
          <Steps
            items={[
              <>Open <K>/programme/&#123;projectId&#125;</K>.</>,
              <>Click <b>Upload Programme</b>. Pick a PDF exported from Asta / P6 / MS Project.</>,
              <>Wait 15–60s while Randall parses it (progress shown in the terminal).</>,
              <>The Playbook appears with today's tasks. Use the day picker to move ±1 day.</>,
            ]}
          />
          <Fig src={s14} caption="Fig 7.1 · /programme/{projectId} — Randall's Diary" />
          <Hint>
            Randall works best on Gantt PDFs that include a text task list (not scanned
            images). If the PDF is scanned, print-to-PDF the task table view instead.
          </Hint>
          <Broken>
            <b>"Randall could not read a task schedule from this PDF."</b> The PDF is image-only
            or has no readable task rows. Export as text-PDF, or paste the task list into a CSV.
          </Broken>
          <Broken>
            <b>Dates look wrong on today's playbook.</b> Randall reads the start date from the
            programme. If it starts in the future, the playbook is empty until that day. Adjust
            the baseline in your planner and re-upload.
          </Broken>
        </>
      ),
    },
    {
      id: "quick-refs",
      num: "8",
      title: "Quick-refs — Snag Master, Tooling, Weekly Pack, Bible",
      roles: "Everyone",
      searchText: "snag tooling oracle weekly pack bible notifications bell",
      content: (
        <>
          <p className="font-bold text-alert">Snag Master</p>
          <p>
            Top nav → <Link to="/snags" className="text-alert underline">Snag Master</Link> →{" "}
            <b>+ New Scan</b> → snap or upload a photo → The Oracle writes a defect report
            citing UK Building Regs / CDM 2015. Save adds it to the Bible and notifies members.
          </p>
          <Fig src={s06} caption="Fig 8.1 · /snags — your snag list" />

          <p className="mt-4 font-bold text-alert">AI Tooling · The Oracle</p>
          <p>
            Top nav → orange{" "}
            <Link to="/tooling" className="text-alert underline">AI Tooling</Link>. Three orange
            3D buttons: <b>Scan</b> (camera), <b>Upload</b> (image or PDF), <b>View</b>
            (previewer). Type in the terminal; the Oracle streams a referenced answer.
          </p>
          <Fig src={s07} caption="Fig 8.2 · /tooling — the Oracle cockpit" />

          <p className="mt-4 font-bold text-alert">Weekly Subcontractor Pack</p>
          <p>
            Inside a project, on <K>/subcontractor-pack/&#123;id&#125;</K>, subs click{" "}
            <b>Submit Weekly Pack</b>. A branded PDF is generated with the week's registers,
            toolbox talks, look-aheads and an APPENDIX of every uploaded competency card /
            certificate as embedded images.
          </p>

          <p className="mt-4 font-bold text-alert">Project Bible</p>
          <p>
            Everything ends up here. Filter by document type, search by title, open the viewer
            full-screen, download or print. Adding to Bible is one click from any report.
          </p>

          <p className="mt-4 font-bold text-alert">Notifications</p>
          <p>
            🔔 bell in the nav. Fires when a report is added to a Bible you belong to, when
            someone invites you, or when a weekly pack is submitted on a project you manage.
          </p>
        </>
      ),
    },
    {
      id: "role-index",
      num: "A",
      title: "Role Quick-Reference Index",
      roles: "Read only your row",
      searchText: "role reference founder master admin site manager pm subcontractor",
      content: (
        <>
          <p>Read only the sections that apply to your role:</p>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-black/50 text-[0.65rem] uppercase tracking-widest text-alert">
                <tr>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Read sections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-foreground/85">
                <tr><td className="px-3 py-2 font-bold">Founder (owner)</td><td className="px-3 py-2">1, 2, 3, 4, 5, 6, 7, 8</td></tr>
                <tr><td className="px-3 py-2 font-bold">Master / Project Admin</td><td className="px-3 py-2">1, 3, 4, 5, 6, 7, 8</td></tr>
                <tr><td className="px-3 py-2 font-bold">Site Manager</td><td className="px-3 py-2">1, 5, 6, 8</td></tr>
                <tr><td className="px-3 py-2 font-bold">Project Manager (invited)</td><td className="px-3 py-2">1, 3, 4, 5, 8</td></tr>
                <tr><td className="px-3 py-2 font-bold">Subcontractor</td><td className="px-3 py-2">1, 3, 8 (Weekly Pack)</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-foreground/60">
            <BookOpen size={14} className="text-alert" />
            Prefer paper? Download the full PDF from the top of this page.
          </div>
        </>
      ),
    },
  ];
}
