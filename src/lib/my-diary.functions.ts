import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns the packages (subcontractor_invites) the calling user is the
// Package Manager for on this project. Relies on the RLS policy added in
// the Package Manager assignment migration ("Package managers view their
// assigned packages") — the query naturally returns nothing for packages
// this user doesn't manage, so no extra filtering is needed here.
export const listMyManagedPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("subcontractor_invites")
      .select("id, company_name, trade_packages")
      .eq("project_id", data.projectId)
      .eq("package_manager_id", context.userId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// The personal diary feed itself: every live pin and every checked-out
// diary entry, but ONLY for packages this user manages.
//
// Linked by subcontractor_invites.accepted_by (the individual user account
// that scanned the QR / accepted the invite) rather than by trade_package
// text. This matters: the app currently has two different, inconsistent
// hardcoded trade-name lists (TradeDirectoryPanel.tsx uses "Structural
// Steels" / "M&E"; subcontractors.new.tsx uses "Steel Frame" / separate
// "Mechanical"/"Electrical"/"Plumbing" entries), both writing free text
// into the same trade_packages column with nothing enforcing they match.
// Matching by trade_package text would silently drop activity whenever
// those lists diverge. accepted_by is an exact user id, unaffected by
// that inconsistency.
//
// One further subtlety: a single company can hold up to 3 separate
// subcontractor_invites rows for the same project (1 admin seat + 2
// read-only seats — see subcontractor_seat_usage()), each with its own
// accepted_by user. Assigning a Package Manager on only one seat's invite
// would silently miss the other seats' activity. So once we know which
// invite(s) this manager is assigned to, we expand to every accepted seat
// sharing the same (project_id, company_name) — the manager owns the
// company's package, not one individual's seat.
export const listMyDiaryFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: assigned, error: pkgErr } = await (context.supabase as any)
      .from("subcontractor_invites")
      .select("id, company_name, trade_packages, accepted_by")
      .eq("project_id", data.projectId)
      .eq("package_manager_id", context.userId)
      .is("revoked_at", null);
    if (pkgErr) throw new Error(pkgErr.message);

    const companyNames = Array.from(
      new Set(
        (assigned ?? []).map((p: { company_name: string }) => p.company_name.toLowerCase()),
      ),
    );

    if (companyNames.length === 0) {
      return { packages: [], livePins: [], diaries: [], workfaces: [] };
    }

    // Expand to every accepted seat for these companies on this project.
    const { data: allSeats, error: seatsErr } = await (context.supabase as any)
      .from("subcontractor_invites")
      .select("id, company_name, trade_packages, accepted_by")
      .eq("project_id", data.projectId)
      .is("revoked_at", null)
      .not("accepted_by", "is", null);
    if (seatsErr) throw new Error(seatsErr.message);

    const packages = (allSeats ?? []).filter(
      (s: { company_name: string }) => companyNames.includes(s.company_name.toLowerCase()),
    ) as Array<{ id: string; company_name: string; trade_packages: string[]; accepted_by: string | null }>;

    const managedUserIds = packages
      .map((p) => p.accepted_by)
      .filter((id): id is string => Boolean(id));

    if (managedUserIds.length === 0) {
      return { packages, livePins: [], diaries: [], workfaces: [] };
    }

    const [pinsRes, diariesRes, workfacesRes] = await Promise.all([
      (context.supabase as any)
        .from("live_site_activity")
        .select(
          "id, zone_id, workface_id, drawing_id, trade_package, operative_count, start_time, scheduled_finish, status, notes, permit_status, high_risk_flags, work_zones(name, level)",
        )
        .eq("project_id", data.projectId)
        .eq("status", "active")
        .in("subcontractor_id", managedUserIds)
        .order("start_time", { ascending: false }),
      (context.supabase as any)
        .from("daily_site_diaries")
        .select(
          "id, zone_id, workface_id, trade_package, operative_count, hours_logged, progress_status, completion_pct, manager_completion_pct, qs_verified_pct, notes, photo_urls, qs_status, checkout_time, work_zones(name, level)",
        )
        .eq("project_id", data.projectId)
        .in("subcontractor_id", managedUserIds)
        .order("checkout_time", { ascending: false })
        .limit(100),
      (context.supabase as any)
        .from("workfaces")
        .select("id, name, stage, zone_id, package_invite_id, status")
        .eq("project_id", data.projectId)
        .in(
          "package_invite_id",
          packages.map((p: { id: string }) => p.id),
        )
        .neq("status", "archived"),
    ]);
    if (pinsRes.error) throw new Error(pinsRes.error.message);
    if (diariesRes.error) throw new Error(diariesRes.error.message);
    if (workfacesRes.error) throw new Error(workfacesRes.error.message);

    return {
      packages,
      livePins: pinsRes.data ?? [],
      diaries: diariesRes.data ?? [],
      workfaces: workfacesRes.data ?? [],
    };
  });
