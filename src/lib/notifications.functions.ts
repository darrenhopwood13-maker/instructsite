import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  link_to: string | null;
  read_at: string | null;
  created_at: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().min(1).max(50).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ items: NotificationRow[]; unread: number }> => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 20;
    const { data: items, error } = await supabase
      .from("notifications")
      .select("id,user_id,project_id,kind,title,body,link_to,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    const { count } = await supabase
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .is("read_at", null);
    return { items: (items ?? []) as NotificationRow[], unread: count ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
