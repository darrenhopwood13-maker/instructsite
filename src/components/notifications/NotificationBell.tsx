import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";


export function NotificationBell() {
  const listFn = useServerFn(listMyNotifications);
  const readFn = useServerFn(markNotificationRead);
  const readAllFn = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The header uses backdrop-blur, which creates its own stacking context, so a
  // z-indexed panel inside it can never paint above the page content. The panel
  // is portalled to <body> and positioned from the button's viewport rect.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const q = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => listFn({ data: { limit: 15 } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        wrapRef.current &&
        !wrapRef.current.contains(t) &&
        !(panelRef.current && panelRef.current.contains(t))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications", "me"] });

  const onItemClick = async (n: (typeof items)[number]) => {
    if (!n.read_at) {
      try {
        await readFn({ data: { id: n.id } });
        invalidate();
      } catch (e) {
        toast.error(errorMessage(e, "Couldn't mark that notification as read."));
      }
    }
    if (n.link_to) {
      window.location.assign(n.link_to);
    }
  };

  const onMarkAll = async () => {
    try {
      await readAllFn();
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't mark notifications as read."));
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="glass-btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos?.top ?? 64, right: pos?.right ?? 16 }}
          className="glass-panel fixed z-[9999] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-white/10 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-alert">
              Notifications
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-widest text-foreground/60 hover:text-foreground"
              >
                <Check className="h-3 w-3" /> Mark all
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-foreground/50">
                Nothing yet.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={`flex w-full flex-col gap-1 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                    n.read_at ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {n.title}
                    </span>
                    {!n.read_at && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-alert" />
                    )}
                  </div>
                  {n.body && (
                    <span className="text-xs text-foreground/70 line-clamp-2">
                      {n.body}
                    </span>
                  )}
                  <span className="text-[0.6rem] uppercase tracking-widest text-foreground/40">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
