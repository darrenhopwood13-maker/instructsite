import type { ReactNode } from "react";
import { GuideAnchor, GuideAppear, GuideDropZone, GuideField } from "./GuideDemo";
import type { MockKey } from "./missions";

const Frame = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex h-full w-full flex-col bg-background text-foreground">
    <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-widest text-foreground/60">
      <span className="h-2 w-2 rounded-full bg-alert" />
      {title}
    </div>
    <div className="flex-1 p-3">{children}</div>
  </div>
);

const Btn = ({ refName, children, primary }: { refName: string; children: ReactNode; primary?: boolean }) => (
  <GuideAnchor
    refName={refName}
    className={
      "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider " +
      (primary ? "bg-[hsl(22_100%_54%)] text-white" : "border border-border bg-muted/40 text-foreground")
    }
  >
    {children}
  </GuideAnchor>
);

export function MissionMock({ k }: { k: MockKey }) {
  switch (k) {
    case "org":
      return (
        <Frame title="Organisations">
          <div className="flex justify-end"><Btn refName="newOrg" primary>+ New Organisation</Btn></div>
          <div className="mt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-foreground/60">Company name</div>
            <GuideField refName="orgName" placeholder="e.g. Hopwood Construction" />
            <div className="pt-2"><Btn refName="createOrg" primary>Create</Btn></div>
          </div>
        </Frame>
      );
    case "invite":
      return (
        <Frame title="Members">
          <div className="flex justify-end"><Btn refName="inviteBtn" primary>+ Invite Member</Btn></div>
          <div className="mt-3 space-y-2">
            <GuideField refName="email" placeholder="email@company.com" />
            <div className="flex gap-2">
              <GuideAnchor refName="role" className="rounded-md border border-border px-2 py-1 text-[11px]">Project Manager ▾</GuideAnchor>
            </div>
            <div className="pt-2"><Btn refName="send" primary>Send Invite</Btn></div>
          </div>
        </Frame>
      );
    case "project":
      return (
        <Frame title="New Project">
          <div className="flex justify-end"><Btn refName="newProj" primary>+ New Project</Btn></div>
          <div className="mt-3 space-y-2">
            <GuideField refName="projName" placeholder="Project name" />
            <GuideField refName="addr" placeholder="Site address" />
            <div className="pt-2"><Btn refName="createProj" primary>Create Project</Btn></div>
          </div>
        </Frame>
      );
    case "bible":
      return (
        <Frame title="Project Bible">
          <div className="flex justify-end"><Btn refName="openBible">Open Bible</Btn></div>
          <div className="mt-3"><GuideDropZone refName="drop" label="Drop PDFs, images, drawings…" /></div>
          <GuideAppear refName="row" className="mt-3 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs">
            📄 method-statement-v1.pdf
          </GuideAppear>
        </Frame>
      );
    case "drawing":
      return (
        <Frame title="Drawings">
          <div className="flex justify-end"><Btn refName="drawings">Drawings</Btn></div>
          <div className="mt-3"><GuideDropZone refName="drop" label="Drop the GA drawing PDF" /></div>
          <GuideAppear refName="thumb" className="mt-3 h-16 rounded-md border border-border bg-gradient-to-br from-muted/60 to-muted/20" />
        </Frame>
      );
    case "dabs":
      return (
        <Frame title="DABS">
          <div className="flex items-center justify-between">
            <Btn refName="openDabs">Today's DABS</Btn>
            <Btn refName="publish" primary>Publish</Btn>
          </div>
          <GuideAnchor refName="zone" className="mt-3 flex h-16 items-center justify-center rounded-md border border-dashed border-border text-[11px] text-foreground/60">
            Zone A — assign crew
          </GuideAnchor>
        </Frame>
      );
    case "pins":
      return (
        <Frame title="Live Board">
          <GuideAnchor refName="canvas" className="relative h-24 rounded-md border border-border bg-gradient-to-br from-muted/60 to-muted/20">
            <GuideAppear refName="pin" className="absolute left-[45%] top-[40%] h-3 w-3 rounded-full bg-[hsl(22_100%_54%)] shadow-[0_0_12px_hsl(22_100%_54%)]" />
          </GuideAnchor>
          <div className="mt-2 flex gap-1"><Btn refName="trade">Bricklayers ▾</Btn></div>
        </Frame>
      );
    case "diary":
      return (
        <Frame title="Daily Diary">
          <Btn refName="openDiary">Today's diary</Btn>
          <div className="mt-2"><GuideField refName="note" placeholder="Weather, crews, deliveries…" /></div>
          <div className="pt-2"><Btn refName="save" primary>Save</Btn></div>
        </Frame>
      );
    case "snags":
      return (
        <Frame title="Snag Master">
          <div className="flex justify-end"><Btn refName="newSnag" primary>+ New Snag</Btn></div>
          <div className="mt-3"><GuideDropZone refName="drop" label="Attach a photo" /></div>
          <GuideAppear refName="result" className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
            ✓ Cracked skirting — action: replace section
          </GuideAppear>
        </Frame>
      );
    case "oracle":
      return (
        <Frame title="The Oracle">
          <GuideField refName="prompt" placeholder="Ask the Oracle…" />
          <div className="mt-2 flex justify-end"><Btn refName="send" primary>Send</Btn></div>
          <GuideAppear refName="reply" className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
            Today's high-risk items: hot works on roof, MEWP by west gable.
          </GuideAppear>
        </Frame>
      );
  }
}
