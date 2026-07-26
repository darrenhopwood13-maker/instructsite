import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * A single action in the page header menu. `to`/`params` are passed
 * straight through to a TanStack Router <Link>, so this works with the
 * same routing props used everywhere else in the app.
 */
export type PageAction = {
  label: string;
  icon: ReactNode;
  to: string;
  params?: Record<string, string>;
  /** Visually distinguishes the single most important action (e.g. the
   * one primary next-step). At most one action per page should set this. */
  primary?: boolean;
};

/**
 * Standard page header: an overline label, an overflow-safe title/
 * subtitle block, and a collapsed dropdown menu for page actions instead
 * of a loose row of buttons that can collide with a long title.
 *
 * Replaces the repeated pattern (seen across projects.$projectId.tsx,
 * site-manager.$projectId.tsx, dabs.$projectId.tsx, programme.$projectId.tsx,
 * and others) of 2-5 unwrapped glass-btn links sitting next to a large
 * heading with no width constraint.
 */
export function PageHeader({
  overline,
  title,
  subtitle,
  actions,
  LinkComponent,
}: {
  overline?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: PageAction[];
  /** The app's <Link> component (from @tanstack/react-router), passed in
   * to avoid a circular import here. */
  LinkComponent: React.ComponentType<{
    to: string;
    params?: Record<string, string>;
    className?: string;
    children?: ReactNode;
  }>;
}) {
  const Link = LinkComponent;
  return (
    <div className="flex min-w-0 items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {overline && (
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            {overline}
          </p>
        )}
        <h1
          className="mt-1 break-words text-3xl font-extrabold uppercase leading-tight tracking-tight text-foreground md:text-4xl"
          style={{ fontFamily: "'Michroma', 'Inter Tight', sans-serif" }}
        >
          {title}
        </h1>
        {subtitle && <div className="mt-2 text-sm text-foreground/70">{subtitle}</div>}
      </div>

      {actions && actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="glass-btn inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs uppercase tracking-wider outline-none">
            <MoreHorizontal size={16} />
            <span className="hidden sm:inline">Actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            {actions.map((a) => (
              <DropdownMenuItem key={a.to} asChild>
                <Link
                  to={a.to}
                  params={a.params}
                  className={`flex w-full items-center gap-2.5 ${
                    a.primary ? "font-bold text-alert" : ""
                  }`}
                >
                  {a.icon}
                  {a.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
