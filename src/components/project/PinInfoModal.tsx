import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Clock,
  HardHat,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { getPinDetail } from "@/lib/live-activity.functions";
import { pinColor, pinKey } from "@/lib/pin-color";

function fmtDuration(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function PinInfoModal({
  pinId,
  onClose,
  actions,
}: {
  pinId: string;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const detailFn = useServerFn(getPinDetail);
  const q = useQuery({
    queryKey: ["pin-detail", pinId],
    queryFn: () => detailFn({ data: { pinId } }),
    refetchInterval: 15_000,
  });

  const pin: any = q.data?.pin ?? null;
  const key = pinKey({
    trade_package: pin?.trade_package,
    subcontractor_id: pin?.subcontractor_id,
    company_name: q.data?.companyName ?? null,
  });
  const palette = pinColor(key);

  const now = Date.now();
  const elapsed = pin?.start_time
    ? fmtDuration(now - new Date(pin.start_time).getTime())
    : "—";
  const overtime =
    pin?.scheduled_finish && new Date(pin.scheduled_finish).getTime() < now;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Pin details"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative w-full max-w-md overflow-hidden border-2 p-0"
        style={{ borderColor: palette.hex }}
      >
        <div
          className="flex items-start justify-between gap-3 p-5"
          style={{ backgroundColor: palette.soft }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full ring-2"
                style={{ backgroundColor: palette.hex, boxShadow: `0 0 0 4px ${palette.ring}` }}
                aria-hidden
              />
              <p
                className="text-[0.6rem] font-bold uppercase tracking-[0.32em]"
                style={{ color: palette.hex }}
              >
                Live Pin
              </p>
            </div>
            <h3
              className="mt-1 truncate text-lg font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {pin?.trade_package ?? "Untagged Crew"}
            </h3>
            <p className="mt-0.5 truncate text-[0.65rem] uppercase tracking-widest text-foreground/60">
              {q.data?.companyName ?? q.data?.subcontractorName ?? "Loading crew…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-white/15 p-1.5 text-foreground/60 hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 p-5 pt-4 text-xs text-foreground/85">
          {q.isLoading && (
            <p className="flex items-center gap-2 text-foreground/60">
              <Loader2 size={12} className="animate-spin" /> Loading details…
            </p>
          )}
          {q.isError && (
            <p className="text-red-400">
              {(q.error as Error)?.message ?? "Failed to load pin."}
            </p>
          )}

          {pin && (
            <>
              <Row icon={<Building2 size={12} />} label="Company">
                {q.data?.companyName ?? "—"}
              </Row>
              <Row icon={<HardHat size={12} />} label="Operative">
                {q.data?.subcontractorName ?? "—"}
              </Row>
              <Row icon={<Users size={12} />} label="Crew size">
                {pin.operative_count} operatives
              </Row>
              <Row icon={<MapPin size={12} />} label="Location">
                {pin.work_zones?.name ?? "No zone"}
                {pin.work_zones?.level ? ` · ${pin.work_zones.level}` : ""}
              </Row>
              <Row icon={<Clock size={12} />} label="Started">
                {pin.start_time ? new Date(pin.start_time).toLocaleString() : "—"}
                <span className="ml-1 text-foreground/50">· {elapsed} elapsed</span>
              </Row>
              <Row icon={<Clock size={12} />} label="Scheduled finish">
                {pin.scheduled_finish
                  ? new Date(pin.scheduled_finish).toLocaleString()
                  : "—"}
              </Row>

              {pin.notes && (
                <div className="rounded-md border border-white/10 bg-black/30 p-2.5">
                  <p className="text-[0.55rem] font-bold uppercase tracking-[0.28em] text-foreground/50">
                    Planned activity
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[0.75rem] text-foreground/80">
                    {pin.notes}
                  </p>
                </div>
              )}

              {overtime && (
                <p className="rounded-sm border border-red-500 bg-red-600/20 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-red-400">
                  Overtime · past scheduled finish
                </p>
              )}

              <PermitsBlock
                needed={!!pin.permit_required}
                status={pin.permit_status}
                flags={pin.high_risk_flags ?? []}
                permits={q.data?.permits ?? []}
              />
            </>
          )}

          {actions && <div className="border-t border-white/10 pt-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-alert">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.55rem] font-bold uppercase tracking-[0.28em] text-foreground/50">
          {label}
        </p>
        <p className="truncate text-foreground/85">{children}</p>
      </div>
    </div>
  );
}

function PermitsBlock({
  needed,
  status,
  flags,
  permits,
}: {
  needed: boolean;
  status?: string | null;
  flags: string[];
  permits: Array<{
    id: string;
    permit_type: string;
    status: string;
    valid_from: string | null;
    valid_to: string | null;
  }>;
}) {
  const active = permits.filter(
    (p) =>
      p.status === "active" &&
      (!p.valid_to || new Date(p.valid_to).getTime() > Date.now()),
  );

  if (!needed && active.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-[0.65rem] uppercase tracking-widest text-emerald-300">
        <ShieldCheck size={12} className="mr-1 inline" /> No permits required
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {needed && status !== "active" && active.length === 0 && (
        <div className="rounded-md border-2 border-amber-400 bg-amber-400/10 p-2.5">
          <p className="flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-amber-300">
            <ShieldAlert size={12} /> Permit required · awaiting sign-off
          </p>
          {flags.length > 0 && (
            <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-amber-200/80">
              {flags.map((f) => f.replace(/_/g, " ")).join(" · ")}
            </p>
          )}
        </div>
      )}
      {active.map((p) => (
        <div
          key={p.id}
          className="rounded-md border border-emerald-500/50 bg-emerald-500/10 p-2.5"
        >
          <p className="flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-emerald-300">
            <ShieldCheck size={12} /> Permit active · {p.permit_type.replace(/_/g, " ")}
          </p>
          <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-emerald-200/80">
            Valid{" "}
            {p.valid_from ? new Date(p.valid_from).toLocaleTimeString() : "—"} →{" "}
            {p.valid_to ? new Date(p.valid_to).toLocaleTimeString() : "open"}
          </p>
        </div>
      ))}
    </div>
  );
}
