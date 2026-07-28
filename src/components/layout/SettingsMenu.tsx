import { useEffect, useState } from "react";
import { Link, useMatches, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Building2,
  Camera,
  Sparkles,
  BookOpen,
  LifeBuoy,
  GraduationCap,
  Bell,
  Check,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";

type NavItem = {
  key: string;
  label: string;
  to: string;
  params?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
};

function useCurrentProjectId(): string | null {
  const matches = useMatches();
  for (const m of matches) {
    const params = m.params as Record<string, string | undefined>;
    if (params?.projectId) return params.projectId;
  }
  return null;
}

export function SettingsMenu({ isOwner }: { isOwner: boolean }) {
  const projectId = useCurrentProjectId();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(now)
    : "";

  const listFn = useServerFn(listMyNotifications);
  const readFn = useServerFn(markNotificationRead);
  const readAllFn = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  const notif = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => listFn({ data: { limit: 15 } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const items = notif.data?.items ?? [];
  const unread = notif.data?.unread ?? 0;
  const invalidateNotif = () =>
    qc.invalidateQueries({ queryKey: ["notifications", "me"] });

  const onItemClick = async (n: (typeof items)[number]) => {
    if (!n.read_at) {
      try {
        await readFn({ data: { id: n.id } });
        invalidateNotif();
      } catch {
        /* ignore */
      }
    }
    if (n.link_to) window.location.assign(n.link_to);
  };
  const onMarkAll = async () => {
    try {
      await readAllFn();
      invalidateNotif();
    } catch {
      /* ignore */
    }
  };

  const navItems: NavItem[] = [
    isOwner
      ? {
          key: "org",
          label: "Organisation",
          to: "/org",
          icon: Building2,
          match: (p) => p.startsWith("/org"),
        }
      : {
          key: "projects",
          label: "Projects",
          to: "/projects",
          icon: Building2,
          match: (p) => p.startsWith("/projects") && !p.includes("/bible"),
        },
    {
      key: "snags",
      label: "Snag Master",
      to: "/snags",
      icon: Camera,
      match: (p) => p.startsWith("/snags"),
    },
    {
      key: "oracle",
      label: "The Oracle",
      to: "/tooling",
      icon: Sparkles,
      match: (p) => p.startsWith("/tooling"),
    },
  ];
  if (projectId) {
    navItems.push({
      key: "bible",
      label: "Project Bible",
      to: "/projects/$projectId/bible",
      params: { projectId },
      icon: BookOpen,
      match: (p) => p.includes("/bible"),
    });
  }

  const learnItems: NavItem[] = [
    {
      key: "start",
      label: "Quick Start",
      to: "/start",
      icon: GraduationCap,
      match: (p) => p === "/start",
    },
    {
      key: "manual",
      label: "Manual",
      to: "/manual",
      icon: LifeBuoy,
      match: (p) => p === "/manual",
    },
  ];

  const renderItem = (n: NavItem) => {
    const active = n.match(path);
    const Icon = n.icon;
    return (
      <DropdownMenuItem key={n.key} asChild>
        <Link
          to={n.to}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          params={n.params as any}
          className={`flex w-full cursor-pointer items-center gap-2 text-xs uppercase tracking-widest ${
            active ? "bg-white/10 text-[#ff9a3d]" : ""
          }`}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="flex-1">{n.label}</span>
          {active && <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a00]" />}
        </Link>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="glass-btn relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs uppercase tracking-widest"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#ff7a00] shadow-[0_0_8px_rgba(255,122,0,0.9)]"
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 border-white/10 bg-black/90 text-foreground backdrop-blur"
      >
        <DropdownMenuLabel className="flex items-center gap-2 text-[0.6rem] uppercase tracking-widest text-foreground/60">
          <Calendar className="h-3 w-3" />
          <span className="truncate">{dateStr || "\u00a0"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[0.6rem] uppercase tracking-widest text-alert">
          Navigate
        </DropdownMenuLabel>
        <DropdownMenuGroup>{navItems.map(renderItem)}</DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[0.6rem] uppercase tracking-widest text-alert">
          Learn
        </DropdownMenuLabel>
        <DropdownMenuGroup>{learnItems.map(renderItem)}</DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center justify-between text-[0.6rem] uppercase tracking-widest text-alert">
          <span className="inline-flex items-center gap-2">
            <Bell className="h-3 w-3" />
            Alerts
            {unread > 0 && (
              <span className="rounded-full bg-alert px-1.5 py-0.5 text-[0.55rem] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onMarkAll();
              }}
              className="inline-flex items-center gap-1 text-[0.55rem] normal-case tracking-wide text-foreground/60 hover:text-foreground"
            >
              <Check className="h-3 w-3" /> Mark all
            </button>
          )}
        </DropdownMenuLabel>
        <div className="max-h-64 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-foreground/50">
              Nothing yet.
            </p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onItemClick(n);
                }}
                className={`flex flex-col items-start gap-1 ${
                  n.read_at ? "opacity-60" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {n.title}
                  </span>
                  {!n.read_at && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-alert" />
                  )}
                </div>
                {n.body && (
                  <span className="line-clamp-2 text-[0.7rem] text-foreground/70">
                    {n.body}
                  </span>
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
