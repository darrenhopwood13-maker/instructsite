import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { toast } from "sonner";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import {
  listPermitRegister,
  issueActivityPermit,
  revokePermit,
  type PermitRow,
} from "@/lib/permits.functions";
import { issuePinPermit } from "@/lib/live-activity.functions";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { HIGH_RISK_CATEGORIES, hazardLabel, type HazardKey } from "@/lib/high-risk";
import {
  isPermitLive,
  isPermitExpired,
  permitLifecycle,
  LIFECYCLE_LABEL,
} from "@/lib/permit-status";

export const Route = createFileRoute("/permits/$projectId")({
  head: () => ({
    meta: [
      { title: "Permit Register — High-Risk Work Control | instructSite" },
      {
        name: "description",
        content:
          "Issue, review and revoke permits to work for high-risk site activities flagged automatically from DABS briefings.",
      },
      { property: "og:title", content: "Permit Register — High-Risk Work Control" },
      {
        property: "og:description",
        content:
          "Every high-risk activity on site, its permit status and who signed it off.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PermitsPage,
});


function PermitsPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const getP = useServerFn(getProject);
  const rolesFn = useServerFn(getMyRoles);
  const registerFn = useServerFn(listPermitRegister);
  const issueFn = useServerFn(issueActivityPermit);
  const issuePinFn = useServerFn(issuePinPermit);
  const revokeFn = useServerFn(revokePermit);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
  });
  const rolesQ = useQuery({ queryKey: ["my-roles"], queryFn: () => rolesFn(), staleTime: 60_000 });
  const roles = rolesQ.data?.roles ?? [];
  const canIssue =
    roles.includes("master_admin") ||
    roles.includes("project_admin") ||
    roles.includes("site_manager");
  const isQs = roles.includes("qs");

  const reg = useQuery({
    queryKey: ["permit-register", projectId],
    queryFn: () => registerFn({ data: { projectId } }),
    refetchInterval: 20_000,
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [issueTarget, setIssueTarget] = useState<
    | { kind: "activity"; id: string; label: string; flags: string[] }
    | { kind: "pin"; id: string; label: string; flags: string[] }
    | null
  >(null);

  const activities = reg.data?.activities ?? [];
  const unlinkedPins = reg.data?.unlinkedPins ?? [];

  const permitted = activities.filter((a) => (a.permits ?? []).some((p) => isPermitLive(p)));
  // Expired = a permit that ran out without being renewed or revoked, and the
  // activity has nothing live covering it. This is the "needs attention" state.
  const expired = activities.filter(
    (a) =>
      !(a.permits ?? []).some((p) => isPermitLive(p)) &&
      (a.permits ?? []).some((p) => isPermitExpired(p)),
  );
  const expiredIds = new Set(expired.map((a) => a.id));
  const outstanding = activities.filter(
    (a) => a.permit_status === "required" && !expiredIds.has(a.id),
  );
  const history = activities.filter(
    (a) =>
      (a.permits ?? []).length > 0 &&
      !(a.permits ?? []).some(isPermitLive) &&
      !expiredIds.has(a.id),
  );


  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["permit-register", projectId] });
    qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
  };

  const doRevoke = async (permitId: string) => {
    setBusyId(permitId);
    try {
      await revokeFn({ data: { permitId, reason: "Revoked from permit register" } });
      toast.success("Permit revoked · work returned to permit-required.");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to revoke permit.");
    } finally {
      setBusyId(null);
    }
  };

  if (project.isError) {
    return <AccessDeniedScreen message={(project.error as Error)?.message} />;
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> {project.data?.name ?? "Project"}
        </Link>

        <h1
          className="mt-3 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Permit Register
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/70">
          Every activity logged on site is hazard-scanned automatically. Anything matching
          the high-risk vocabulary is held at{" "}
          <span className="text-amber-300">permit required</span> until a site manager or
          project admin signs it off here.
        </p>

        {!canIssue && (
          <p className="mt-4 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs uppercase tracking-widest text-foreground/60">
            {isQs
              ? "QS view · read-only. Permit issuance is restricted to site managers and project admins."
              : "Read-only view · permit issuance is restricted to site managers and project admins."}
          </p>
        )}

        {reg.isLoading && (
          <p className="mt-8 flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 size={14} className="animate-spin" /> Loading register…
          </p>
        )}
        {reg.isError && (
          <p className="mt-8 text-sm text-alert">
            {(reg.error as Error)?.message ?? "Failed to load permit register."}
          </p>
        )}

        {/* AWAITING PERMIT */}
        <Section
          title="Awaiting Permit"
          tone="amber"
          count={outstanding.length + unlinkedPins.length}
        >
          {outstanding.length === 0 && unlinkedPins.length === 0 ? (
            <Empty text="Nothing on site is currently blocked on a permit." />
          ) : (
            <div className="space-y-2">
              {outstanding.map((a) => (
                <Row
                  key={a.id}
                  title={a.description}
                  meta={[
                    a.work_zones?.name ?? null,
                    a.project_drawings?.drawing_no ?? null,
                    (a as any).requested_by_name ?? null,
                    new Date(a.created_at).toLocaleString(),
                  ]}
                  flags={a.high_risk_flags ?? []}
                  action={
                    canIssue ? (
                      <button
                        type="button"
                        onClick={() =>
                          setIssueTarget({
                            kind: "activity",
                            id: a.id,
                            label: a.description,
                            flags: a.high_risk_flags ?? [],
                          })
                        }
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-[0.6rem] font-extrabold uppercase tracking-widest text-black"
                      >
                        Issue Permit
                      </button>
                    ) : null
                  }
                />
              ))}
              {unlinkedPins.map((p) => (
                <Row
                  key={p.id}
                  title={`${p.trade_package ?? "Untagged crew"} — ${p.notes ?? "DABS pin"}`}
                  meta={[
                    p.work_zones?.name ?? null,
                    `${p.operative_count} operatives`,
                    new Date(p.start_time).toLocaleString(),
                    "Legacy pin (no activity record)",
                  ]}
                  flags={p.high_risk_flags ?? []}
                  action={
                    canIssue ? (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={async () => {
                          setBusyId(p.id);
                          try {
                            await issuePinFn({ data: { pinId: p.id, validHours: 8 } });
                            toast.success("Permit issued for pin (8h).");
                            refresh();
                          } catch (err: any) {
                            toast.error(err?.message ?? "Failed to issue permit.");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-[0.6rem] font-extrabold uppercase tracking-widest text-black disabled:opacity-40"
                      >
                        {busyId === p.id ? "Issuing…" : "Issue 8h Permit"}
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          )}
        </Section>

        {/* ACTIVE PERMITS */}
        <Section title="Active Permits" tone="green" count={permitted.length}>
          {permitted.length === 0 ? (
            <Empty text="No permits are currently in force." />
          ) : (
            <div className="space-y-2">
              {permitted.map((a) => {
                const live = (a.permits ?? []).filter(isPermitLive);
                return (
                  <Row
                    key={a.id}
                    tone="green"
                    title={a.description}
                    meta={[
                      a.work_zones?.name ?? null,
                      ...live.map(
                        (p) =>
                          `${hazardLabel(p.permit_type)} · until ${
                            p.valid_to ? new Date(p.valid_to).toLocaleString() : "—"
                          }${p.issued_by_name ? ` · ${p.issued_by_name}` : ""}`,
                      ),
                    ]}
                    flags={a.high_risk_flags ?? []}
                    action={
                      canIssue ? (
                        <div className="flex flex-col gap-1">
                          {live.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => doRevoke(p.id)}
                              className="rounded-md border border-alert px-3 py-1.5 text-[0.6rem] font-extrabold uppercase tracking-widest text-alert disabled:opacity-40"
                            >
                              {busyId === p.id ? "Revoking…" : "Revoke"}
                            </button>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          )}
        </Section>

        {/* EXPIRED — needs attention */}
        <Section title="Expired — Needs Attention" tone="red" count={expired.length}>
          {expired.length === 0 ? (
            <Empty text="No permits have lapsed without being renewed or revoked." />
          ) : (
            <div className="space-y-2">
              {expired.map((a) => {
                const lapsed = (a.permits ?? []).filter((p) => isPermitExpired(p));
                return (
                  <Row
                    key={a.id}
                    tone="red"
                    title={a.description}
                    meta={[
                      a.work_zones?.name ?? null,
                      ...lapsed.map(
                        (p) =>
                          `${hazardLabel(p.permit_type)} · lapsed ${
                            p.valid_to ? new Date(p.valid_to).toLocaleString() : "—"
                          }${p.issued_by_name ? ` · issued by ${p.issued_by_name}` : ""}`,
                      ),
                    ]}
                    flags={a.high_risk_flags ?? []}
                    action={
                      canIssue ? (
                        <button
                          type="button"
                          onClick={() =>
                            setIssueTarget({
                              kind: "activity",
                              id: a.id,
                              label: a.description,
                              flags: a.high_risk_flags ?? [],
                            })
                          }
                          className="rounded-md bg-alert px-3 py-1.5 text-[0.6rem] font-extrabold uppercase tracking-widest text-black"
                        >
                          Renew Permit
                        </button>
                      ) : null
                    }
                  >
                    <PermitHistory permits={a.permits ?? []} />
                  </Row>
                );
              })}
            </div>
          )}
        </Section>

        {/* HISTORY */}
        <Section title="Closed / Revoked" tone="grey" count={history.length}>
          {history.length === 0 ? (
            <Empty text="No closed permits yet." />
          ) : (
            <div className="space-y-2">
              {history.map((a) => (
                <Row
                  key={a.id}
                  tone="grey"
                  title={a.description}
                  meta={(a.permits ?? []).map(
                    (p) =>
                      `${hazardLabel(p.permit_type)} · ${LIFECYCLE_LABEL[permitLifecycle(p)]} · ${
                        p.valid_to ? new Date(p.valid_to).toLocaleString() : "—"
                      }`,
                  )}
                  flags={a.high_risk_flags ?? []}
                >
                  <PermitHistory permits={a.permits ?? []} />
                </Row>
              ))}
            </div>
          )}
        </Section>

      </div>

      {issueTarget && issueTarget.kind === "activity" && (
        <IssuePermitModal
          label={issueTarget.label}
          flags={issueTarget.flags}
          onClose={() => setIssueTarget(null)}
          onSubmit={async (permitType, validHours) => {
            await issueFn({
              data: { activityId: issueTarget.id, permitType, validHours },
            });
            toast.success("Permit issued · activity cleared to proceed.");
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "amber" | "green" | "grey";
  children: React.ReactNode;
}) {
  const color =
    tone === "amber" ? "text-amber-300" : tone === "green" ? "text-emerald-300" : "text-foreground/50";
  const Icon = tone === "amber" ? ShieldAlert : tone === "green" ? ShieldCheck : ShieldX;
  return (
    <section className="mt-8">
      <h2
        className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] ${color}`}
      >
        <Icon size={14} /> {title} · {count}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-xs text-foreground/50">
      {text}
    </p>
  );
}

function Row({
  title,
  meta,
  flags,
  action,
  tone = "amber",
}: {
  title: string;
  meta: Array<string | null>;
  flags: string[];
  action?: React.ReactNode;
  tone?: "amber" | "green" | "grey";
}) {
  const border =
    tone === "amber"
      ? "border-amber-400/60"
      : tone === "green"
        ? "border-emerald-400/50"
        : "border-white/10";
  return (
    <div
      className={`glass-panel flex flex-wrap items-start justify-between gap-3 border ${border} p-3`}
    >
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[0.65rem] uppercase tracking-widest text-foreground/50">
          {meta.filter(Boolean).join(" · ")}
        </p>
        {flags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {flags.map((f) => (
              <span
                key={f}
                className="rounded-sm border border-amber-400/60 bg-black/30 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-amber-300"
              >
                {hazardLabel(f)}
              </span>
            ))}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

function IssuePermitModal({
  label,
  flags,
  onClose,
  onSubmit,
}: {
  label: string;
  flags: string[];
  onClose: () => void;
  onSubmit: (permitType: HazardKey, validHours: number) => Promise<void>;
}) {
  const first = (flags.find((f) =>
    (HIGH_RISK_CATEGORIES as readonly string[]).includes(f),
  ) ?? "working_at_height") as HazardKey;
  const [permitType, setPermitType] = useState<HazardKey>(first);
  const [validHours, setValidHours] = useState(8);
  const [ack, setAck] = useState({ site: false, ppe: false, rescue: false });
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = ack.site && ack.ppe && ack.rescue && signature.trim().length > 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur">
      <div className="glass-panel w-full max-w-lg max-h-[92vh] overflow-y-auto border-2 border-amber-400 p-6">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-amber-400">
          Permit to Work
        </p>
        <h3
          className="mt-1 text-xl font-extrabold uppercase tracking-tight text-foreground"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          High-Risk Sign-Off
        </h3>
        <p className="mt-3 whitespace-pre-line rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-foreground/85">
          {label}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Permit Type
            </span>
            <select
              value={permitType}
              onChange={(e) => setPermitType(e.target.value as HazardKey)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-xs text-foreground outline-none focus:border-amber-400"
            >
              {HIGH_RISK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {hazardLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Valid Hours
            </span>
            <input
              type="number"
              min={1}
              max={720}
              value={validHours}
              onChange={(e) =>
                setValidHours(Math.max(1, Math.min(720, Number(e.target.value) || 8)))
              }
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-amber-400"
            />
          </label>
        </div>

        <div className="mt-4 space-y-2.5">
          {([
            ["site", "Site conditions inspected · exclusion zone in place"],
            ["ppe", "All operatives briefed · correct PPE confirmed on site"],
            ["rescue", "Rescue plan / fire watch / spotter in place for shift duration"],
          ] as const).map(([k, text]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-xs ${
                ack[k] ? "border-amber-400 bg-amber-400/10 text-foreground" : "border-white/15 text-foreground/70"
              }`}
            >
              <input
                type="checkbox"
                checked={ack[k]}
                onChange={(e) => setAck((prev) => ({ ...prev, [k]: e.target.checked }))}
                className="mt-0.5"
              />
              <span>{text}</span>
            </label>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Manager Signature
          </span>
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Print your name"
            className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-amber-400"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-white/40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(permitType, validHours);
                onClose();
              } catch (err: any) {
                toast.error(err?.message ?? "Failed to issue permit.");
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-5 py-2 text-xs font-extrabold uppercase tracking-widest text-black disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
            Approve Permit
          </button>
        </div>
      </div>
    </div>
  );
}
