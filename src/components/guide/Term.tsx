import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const GLOSSARY: Record<string, string> = {
  organisation: "Your company account. Everyone from your firm lives inside it and shares the same projects.",
  project: "One job site — like 'Willow Bank House'. All the drawings, workers and paperwork for that build sit inside it.",
  subcontractor: "An outside company you hire to do a specific job — bricklayers, sparkies, plumbers, etc.",
  "trade package": "A chunk of the work handed to one type of trade — for example 'all the roofing' or 'all the plastering'.",
  "ga drawing": "General Arrangement drawing — the big picture plan showing where everything goes on the building.",
  revision: "A newer version of a drawing or document. Old one is kept for history, new one is the one to build from.",
  "site logistics plan": "A map that shows where things go on site — cranes, welfare, gates, storage, one-way routes.",
  "work zone": "A shaded area on a drawing that marks where a crew is working today so no one else wanders in.",
  rams: "A safety plan: what could go wrong, and how we will stop it going wrong. Short for Risk Assessment & Method Statement.",
  "method statement": "A step-by-step recipe for doing a job safely. 'First we do this, then this, wearing these gloves.'",
  puwer: "The rules that say the tools and machines on site must be safe and looked after. Short for Provision and Use of Work Equipment Regulations.",
  loler: "The rules for anything that lifts loads — cranes, hoists, slings. They must be checked and certified.",
  "toolbox talk": "A short chat with the crew at the start of a job about the risks and how to stay safe today.",
  "permit to work": "A signed slip that says 'yes, you can start this dangerous job now' — hot work, confined space, working at height.",
  "high-risk work": "Jobs where people get hurt if it goes wrong — working at height, hot works, digging near services, lifting heavy things.",
  dabs: "Daily Activity Briefing Sheet — the 'what are we doing today' plan pinned to the drawing every morning.",
  pin: "A coloured dot on the drawing showing where a crew is working right now. Colour = which trade.",
  shift: "One day's work by one crew on one zone. Has a start time, a finish time and a plan.",
  "daily diary": "The site manager's log of what actually happened today — who turned up, weather, delays, deliveries.",
  qs: "Quantity Surveyor — the person who checks how much work got done so subcontractors get paid the right amount.",
  verification: "A double-check by the QS or site manager to sign off that work was really done before it gets paid.",
  snag: "Something built wrong or not finished properly that has to be put right.",
  programme: "The master timetable for the whole build — what happens in what order and by when.",
  "look-ahead": "A short plan for the next 1–3 weeks pulled from the programme, so crews know what's coming.",
  "ifc model": "The 3D model of the building. You can spin it, click bits and see what they are.",
  "the oracle": "instructSite's built-in AI helper. Ask it a question about your project and it answers using your files.",
  randall: "The nickname for the AI that reads programmes and drawings and pulls the useful bits out for you.",
};

export function Term({ children, k }: { children: ReactNode; k?: string }) {
  const key = (k ?? String(children)).toLowerCase().trim();
  const def = GLOSSARY[key];
  if (!def) return <>{children}</>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "underline decoration-dotted decoration-alert/60 underline-offset-2",
            "hover:decoration-alert focus:outline-none focus:ring-2 focus:ring-alert/40 rounded-sm",
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs text-sm leading-snug">
        <p className="font-semibold capitalize text-foreground mb-1">{key}</p>
        <p className="text-foreground/80">{def}</p>
      </PopoverContent>
    </Popover>
  );
}
