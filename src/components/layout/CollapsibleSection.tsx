import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * The core building block of the site-wide de-clutter pass. Every major
 * panel that used to sit permanently fully-open (Trade Directory, Workface
 * Register, Zone Progress Matrix, Upload Engine, and equivalents on other
 * pages) now lives inside one of these — a card with a header showing
 * enough at-a-glance summary to be useful closed, and full detail one
 * click away.
 *
 * Each section manages its own open/closed state independently — this is
 * deliberately NOT a Radix Accordion (which only allows one item open at a
 * time). On a project setup page you genuinely want Trade Directory and
 * Workface Register open together while you're setting things up, so
 * forcing them to compete for a single "open" slot would be worse UX than
 * what it replaces.
 */
export function CollapsibleSection({
  icon,
  title,
  summary,
  defaultOpen = false,
  tone = "default",
  children,
}: {
  icon?: ReactNode;
  title: string;
  /** A short at-a-glance status shown to the right of the title even when
   * collapsed — e.g. "3 confirmed · 1 proposed", "12 files", "No zones yet". */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** "danger" is for destructive/high-consequence sections (e.g. project
   * deletion) — deliberately understated until opened, rather than sitting
   * fully exposed at the same visual weight as everything else. */
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`overflow-hidden rounded-xl border transition-colors ${
        tone === "danger"
          ? open
            ? "border-red-500/50 bg-red-950/10"
            : "border-white/10 bg-[#0f2444]"
          : "border-white/10 bg-[#0f2444]"
      }`}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] sm:px-5">
        <span className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className={`shrink-0 ${tone === "danger" ? "text-red-400" : "text-alert"}`}>
              {icon}
            </span>
          )}
          <span className="truncate text-[0.7rem] font-bold uppercase tracking-[0.22em] text-foreground/90 sm:text-xs">
            {title}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {summary && (
            <span className="hidden font-mono text-[0.65rem] uppercase tracking-wider text-foreground/45 sm:inline">
              {summary}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`shrink-0 text-foreground/40 transition-transform duration-200 group-hover:text-foreground/70 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </CollapsibleTrigger>
      {summary && (
        <div className="px-4 pb-2 -mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-foreground/45 sm:hidden">
          {summary}
        </div>
      )}
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
        <div className="border-t border-white/10 p-4 sm:p-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
