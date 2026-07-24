import { useEffect, useState, type ReactNode } from "react";
import { Link, useMatches, useLocation } from "@tanstack/react-router";
import {
  Home,
  Camera,
  Sparkles,
  BookOpen,
  LifeBuoy,
  Building2,
  ExternalLink,
  LogIn,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserContextChip } from "@/components/layout/UserContextChip";

/**
 * Locked SaaS shell:
 *   - Fixed top bar (always)
 *   - Fixed left rail on desktop (md+) when signed in
 *   - Fixed bottom tab bar on mobile (<md) when signed in
 *   - Content area is the only scrollable region, with safe-area padding
 *
 * No floating page chrome; every operational surface lives inside the
 * locked frame so the header/nav never scroll away.
 */

const OWNER_EMAIL = "darrenhopwood13@gmail.com";

function useCurrentProjectId(): string | null {
  const matches = useMatches();
  for (const m of matches) {
    const params = m.params as Record<string, string | undefined>;
    if (params?.projectId) return params.projectId;
  }
  return null;
}

function useAuthStatus() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;
    const apply = (email: string | null | undefined) => {
      if (!mounted) return;
      setSignedIn(!!email);
      setIsOwner((email ?? "").trim().toLowerCase() === OWNER_EMAIL);
    };
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => apply(data?.user?.email));
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
        apply(session?.user?.email),
      );
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);
  return { signedIn, isOwner };
}

type NavItem = {
  key: string;
  label: string;
  icon: typeof Home;
  to: string;
  params?: Record<string, string>;
  accent?: boolean;
  matchPrefix?: string;
};

function useNavItems(isOwner: boolean, projectId: string | null): NavItem[] {
  const items: NavItem[] = [
    isOwner
      ? { key: "home", label: "Organisation", icon: Building2, to: "/org", matchPrefix: "/org" }
      : { key: "home", label: "Projects", icon: Home, to: "/projects", matchPrefix: "/projects" },
    { key: "snags", label: "Snag Master", icon: Camera, to: "/snags", matchPrefix: "/snags" },
    { key: "oracle", label: "The Oracle", icon: Sparkles, to: "/tooling", matchPrefix: "/tooling", accent: true },
  ];
  if (projectId) {
    items.push({
      key: "bible",
      label: "Project Bible",
      icon: BookOpen,
      to: "/projects/$projectId/bible",
      params: { projectId },
      matchPrefix: "/projects",
    });
  }
  items.push({ key: "manual", label: "Manual", icon: LifeBuoy, to: "/manual", matchPrefix: "/manual" });
  return items;
}

function TopBar({ signedIn }: { signedIn: boolean | null }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b1e3f]/85 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 md:px-6">
        <Link to="/" className="flex items-baseline gap-0.5 text-base font-extrabold tracking-tight md:text-lg">
          <span style={{ color: "#ff7a00" }}>instruct</span>
          <span className="text-white">Site</span>
        </Link>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <a
                href="https://www.instructsite.ai"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open instructSite site"
                className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-white/80 hover:border-white/40 hover:text-white sm:inline-flex"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden md:inline">instructSite.ai</span>
              </a>
              <NotificationBell />
              <UserContextChip />
            </>
          ) : (
            <>
              <a
                href="https://www.instructsite.ai"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open instructSite site"
                className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/80 hover:border-white/40 hover:text-white sm:inline-flex"
              >
                <ExternalLink className="h-3.5 w-3.5" /> instructSite.ai
              </a>
              <Link
                to="/auth"
                className="glass-orange inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs uppercase tracking-widest"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function LeftRail({ items }: { items: NavItem[] }) {
  const path = useLocation({ select: (l) => l.pathname });
  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-white/10 bg-[#0b1e3f]/80 backdrop-blur-xl md:flex"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 0.75rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.matchPrefix ? path.startsWith(it.matchPrefix) : path === it.to;
          const base =
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";
          const style = it.accent
            ? active
              ? "bg-[#ff7a00] text-[#0b1e3f] shadow-[0_10px_28px_-8px_rgba(249,115,22,0.7)]"
              : "bg-[#ff7a00]/90 text-[#0b1e3f] hover:bg-[#ff7a00]"
            : active
              ? "bg-white/10 text-white"
              : "text-white/70 hover:bg-white/5 hover:text-white";
          return (
            <Link
              key={it.key}
              to={it.to as never}
              params={it.params as never}
              className={`${base} ${style}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-4 pt-2 text-[0.55rem] uppercase tracking-widest text-white/40">
        instructSite · Cockpit
      </div>
    </aside>
  );
}

function BottomTabBar({ items }: { items: NavItem[] }) {
  const path = useLocation({ select: (l) => l.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b1e3f]/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.matchPrefix ? path.startsWith(it.matchPrefix) : path === it.to;
          return (
            <li key={it.key} className="flex-1">
              <Link
                to={it.to as never}
                params={it.params as never}
                className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.55rem] font-semibold uppercase tracking-widest"
              >
                <span
                  className={
                    it.accent
                      ? "grid h-11 w-11 place-items-center rounded-full bg-[#ff7a00] text-[#0b1e3f] shadow-[0_10px_24px_-6px_rgba(249,115,22,0.75)]"
                      : `grid h-9 w-9 place-items-center rounded-xl ${
                          active ? "bg-white/15 text-white" : "text-white/65"
                        }`
                  }
                >
                  <Icon className={it.accent ? "h-5 w-5" : "h-4 w-4"} />
                </span>
                <span className={active ? "text-white" : "text-white/60"}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { signedIn, isOwner } = useAuthStatus();
  const projectId = useCurrentProjectId();
  const items = useNavItems(isOwner, projectId);
  const showChrome = signedIn === true;

  return (
    <div className="relative min-h-screen">
      <TopBar signedIn={signedIn} />
      {showChrome && <LeftRail items={items} />}
      <main
        className="relative"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)",
          paddingBottom: showChrome
            ? "calc(env(safe-area-inset-bottom) + 4.5rem)"
            : "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className={showChrome ? "md:pl-60" : ""}>
          <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
        </div>
      </main>
      {showChrome && <BottomTabBar items={items} />}
    </div>
  );
}
