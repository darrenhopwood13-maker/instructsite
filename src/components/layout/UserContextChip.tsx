import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useMatches } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Building2, HardHat, User as UserIcon, LogOut } from "lucide-react";
import { getSessionContext } from "@/lib/session.functions";
import { getProject } from "@/lib/projects.functions";
import { roleLabel } from "@/lib/role-labels";


function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("") || "?";
}

function useCurrentProjectId(): string | null {
  const matches = useMatches();
  for (const m of matches) {
    const params = m.params as Record<string, string | undefined>;
    if (params?.projectId) return params.projectId;
  }
  return null;
}

export function UserContextChip() {
  const sessionFn = useServerFn(getSessionContext);
  const projectFn = useServerFn(getProject);
  const projectId = useCurrentProjectId();
  const [open, setOpen] = useState(false);

  const session = useQuery({
    queryKey: ["session-context", projectId ?? null],
    queryFn: () => sessionFn(projectId ? { data: { projectId } } : undefined),
    staleTime: 60_000,
    retry: false,
  });

  const project = useQuery({
    queryKey: ["current-project", projectId],
    queryFn: () => projectFn({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 60_000,
    retry: false,
  });

  if (!session.data) return null;
  const s = session.data;
  const primaryRole = s.isFounder
    ? "Founder"
    : s.roles.length > 0
      ? roleLabel(s.roles[0])
      : s.org
        ? roleLabel(s.org.role)
        : "Member";

  const signOut = async () => {
    setOpen(false);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    } catch {
      // ignore — we still want to clear the session locally and redirect
    }
    try {
      const url = new URL(
        (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "",
      );
      const projectRef = url.hostname.split(".")[0];
      const key = `sb-${projectRef}-auth-token`;
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    // Nuke any lingering sb-* auth entries as a belt-and-braces fallback.
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignore
    }
    window.location.replace("/");
  };

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left sm:gap-2 sm:px-2.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff7a00] text-[0.65rem] font-bold text-black">
          {initials(s.fullName)}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-xs font-semibold text-foreground">{s.fullName}</span>
          <span className="truncate text-[0.6rem] uppercase tracking-widest text-foreground/60">
            {primaryRole}
            {project.data ? ` · ${project.data.name}` : ""}
          </span>
        </span>
        <ChevronDown size={12} className="text-foreground/60" />
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpen(false)}
            />
            <div className="fixed right-3 top-16 z-[9999] w-72 rounded-xl border border-white/15 bg-black/90 p-4 text-sm shadow-2xl backdrop-blur">
            <p className="font-semibold text-foreground">{s.fullName}</p>
            <p className="mt-0.5 truncate text-[0.7rem] text-foreground/60">{s.email}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.isFounder && (
                <span className="rounded-full bg-[#ff7a00]/20 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-[#ff9a3d]">
                  Founder
                </span>
              )}
              {s.roles.map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-white/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/80"
                >
                  {roleLabel(r)}
                </span>
              ))}
              {!s.isFounder && s.roles.length === 0 && s.org && (
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/80">
                  {roleLabel(s.org.role)}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
              <div className="flex items-start gap-2">
                <Building2 size={13} className="mt-0.5 text-foreground/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    Organisation
                  </p>
                  {s.org ? (
                    s.org.role === "admin" || s.isFounder ? (
                      <Link
                        to="/org/$orgId"
                        params={{ orgId: s.org.id }}
                        onClick={() => setOpen(false)}
                        className="truncate text-sm text-foreground hover:text-[#ff9a3d]"
                      >
                        {s.org.name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm text-foreground">{s.org.name}</p>
                    )
                  ) : (
                    <p className="text-sm text-foreground/50">No organisation</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <HardHat size={13} className="mt-0.5 text-foreground/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    Current Project
                  </p>
                  {project.data && projectId ? (
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId }}
                      onClick={() => setOpen(false)}
                      className="truncate text-sm text-foreground hover:text-[#ff9a3d]"
                    >
                      {project.data.name}
                    </Link>
                  ) : (
                    <p className="text-sm text-foreground/50">No project selected</p>
                  )}
                </div>
              </div>

            </div>

            <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-3">
              <Link
                to="/projects"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-foreground"
              >
                <UserIcon size={12} /> My projects
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground/80 hover:bg-white/5 hover:text-foreground"
              >
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
