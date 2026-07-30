import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Link2,
  PlusCircle,
  Trash2,
  HardHat,
  Check,
  X,
  Building2,
  ArrowRight,
  UserCog,
  Mail,
  RefreshCw,
  Clock,
  UserPlus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  createSubcontractorInvite,
  listSubcontractorInvites,
  revokeSubcontractorInvite,
  listProjectSiteManagers,
  listUnassignedSiteManagers,
  addSiteManagerToProject,
  assignPackageManager,
  refreshSubcontractorInvite,
  inviteSiteManager,
} from "@/lib/subcontractors.functions";
import { formatSentDate, daysAgo, expiryCountdown } from "@/lib/invite-format";
import { errorMessage } from "@/lib/error-message";

import { TRADE_PACKAGES } from "@/lib/trade-packages";

export function TradeDirectoryPanel({
  projectId,
  ready = true,
}: {
  projectId: string;
  ready?: boolean;
}) {
  const listFn = useServerFn(listSubcontractorInvites);
  const createFn = useServerFn(createSubcontractorInvite);
  const revokeFn = useServerFn(revokeSubcontractorInvite);
  const siteManagersFn = useServerFn(listProjectSiteManagers);
  const unassignedManagersFn = useServerFn(listUnassignedSiteManagers);
  const addManagerFn = useServerFn(addSiteManagerToProject);
  const assignPmFn = useServerFn(assignPackageManager);
  const refreshInviteFn = useServerFn(refreshSubcontractorInvite);
  const inviteManagerFn = useServerFn(inviteSiteManager);
  const qc = useQueryClient();

  const invites = useQuery({
    queryKey: ["subcontractor-invites", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    enabled: ready,
    retry: false,
  });

  const siteManagers = useQuery({
    queryKey: ["project-site-managers", projectId],
    queryFn: () => siteManagersFn({ data: { projectId } }),
    enabled: ready,
    retry: false,
  });

  const unassignedManagers = useQuery({
    queryKey: ["unassigned-site-managers", projectId],
    queryFn: () => unassignedManagersFn({ data: { projectId } }),
    enabled: ready,
    retry: false,
  });

  const [pickedManagerId, setPickedManagerId] = useState("");
  const [addingManager, setAddingManager] = useState(false);

  const addManagerToProject = async () => {
    if (!pickedManagerId) return;
    setAddingManager(true);
    try {
      await addManagerFn({ data: { projectId, userId: pickedManagerId } });
      qc.invalidateQueries({ queryKey: ["project-site-managers", projectId] });
      qc.invalidateQueries({ queryKey: ["unassigned-site-managers", projectId] });
      setPickedManagerId("");
      toast.success("Site Manager added to project.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add Site Manager.");
    } finally {
      setAddingManager(false);
    }
  };

  const [managerEmail, setManagerEmail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [invitingManager, setInvitingManager] = useState(false);
  const [showManagerInvite, setShowManagerInvite] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const inviteAManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerEmail.trim() || invitingManager) return;
    setInvitingManager(true);
    try {
      const res = await inviteManagerFn({
        data: { projectId, email: managerEmail.trim(), fullName: managerName.trim() || null },
      });
      qc.invalidateQueries({ queryKey: ["project-site-managers", projectId] });
      qc.invalidateQueries({ queryKey: ["unassigned-site-managers", projectId] });
      setManagerEmail("");
      setManagerName("");
      if (res.attached) {
        toast.success("Site Manager invited and added to this project.");
      } else if (res.emailed) {
        toast.success("Invite emailed — they join the project once they sign in.");
      } else {
        toast.error(res.emailError ?? "Could not send that invite.");
      }
    } catch (e2) {
      toast.error(errorMessage(e2, "Could not invite that Site Manager."));
    } finally {
      setInvitingManager(false);
    }
  };

  const copyInviteLink = async (inviteId: string) => {
    setRowBusy(inviteId);
    try {
      const res = await refreshInviteFn({ data: { inviteId, resendEmail: false } });
      const url = `${window.location.origin}/invite/${res.token}`;
      await navigator.clipboard.writeText(url);
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success("Fresh invite link copied to clipboard.");
    } catch (e2) {
      toast.error(errorMessage(e2, "Could not generate an invite link."));
    } finally {
      setRowBusy(null);
    }
  };

  const resendInvite = async (inviteId: string) => {
    setRowBusy(inviteId);
    try {
      const res = await refreshInviteFn({ data: { inviteId, resendEmail: true } });
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      if (res.emailed) toast.success(`Invite re-sent to ${res.email}.`);
      else toast.error(res.emailError ?? "Invite link refreshed, but the email did not send.");
    } catch (e2) {
      toast.error(errorMessage(e2, "Could not resend that invite."));
    } finally {
      setRowBusy(null);
    }
  };

  const [companyName, setCompanyName] = useState("");
  const [packages, setPackages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [freshLink, setFreshLink] = useState<{ url: string; company: string } | null>(null);

  const togglePackage = (p: string) =>
    setPackages((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || packages.length === 0) return;
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          projectId,
          companyName: companyName.trim(),
          tradePackages: packages,
        },
      });
      const url = `${window.location.origin}/invite/${res.token}`;
      setFreshLink({ url, company: companyName.trim() });
      setCompanyName("");
      setPackages([]);
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success("Invite generated.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create invite.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeFn({ data: { inviteId: id } });
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success("Invite revoked.");
    } catch (e: any) {
      toast.error(e?.message ?? "Revoke failed.");
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const assignManager = async (inviteId: string, packageManagerId: string | null) => {
    try {
      await assignPmFn({ data: { inviteId, packageManagerId } });
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success(packageManagerId ? "Package Manager assigned." : "Package Manager cleared.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to assign Package Manager.");
    }
  };

  const list = useMemo(() => invites.data ?? [], [invites.data]);
  const managers = useMemo(() => siteManagers.data ?? [], [siteManagers.data]);

  return (
    <div className="mt-2 rounded-lg border border-alert/50 bg-black/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <HardHat className="text-alert" size={12} />
          <p className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.28em] text-alert">
            Project Trade Directory
          </p>
        </div>
        <Link
          to="/subcontractors/new"
          search={{ projectId } as any}
          className="inline-flex items-center gap-1.5 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 text-alert transition hover:bg-alert/20"
        >
          <Building2 size={10} />
          <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.2em]">
            Full Registry
          </span>
          <ArrowRight size={10} />
        </Link>
      </div>

      <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-foreground/60">
            <UserCog size={10} />{" "}
            {managers.length > 0 ? "Site Managers" : "Project Leads"} ({managers.length})
          </p>
        </div>
        {siteManagers.isError && (
          <p className="mt-1 rounded-sm border border-destructive/50 bg-destructive/10 px-1.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-destructive-foreground">
            {(siteManagers.error as Error)?.message ?? "Failed to load site managers."}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5">
          <select
            value={pickedManagerId}
            onChange={(e) => setPickedManagerId(e.target.value)}
            className="min-w-0 flex-1 rounded-sm border border-white/15 bg-black/50 px-1.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/80 outline-none focus:border-alert"
          >
            <option value="">
              {(unassignedManagers.data ?? []).length === 0
                ? "No unassigned Site Managers found"
                : "Add a Site Manager…"}
            </option>
            {(unassignedManagers.data ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name ?? "Unnamed"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addManagerToProject}
            disabled={!pickedManagerId || addingManager}
            className="shrink-0 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-alert transition hover:bg-alert/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {managers.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {managers.map((m) => (
              <span
                key={m.user_id}
                className="rounded-sm border border-white/15 px-1 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest text-foreground/70"
              >
                {m.full_name ?? "Unnamed"}
              </span>
            ))}
          </div>
        )}
      </div>

      {invites.isError && (
        <p className="mt-2 rounded-sm border border-destructive/60 bg-destructive/10 px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-widest text-destructive-foreground">
          {(invites.error as Error)?.message ?? "Failed to load subcontractor invites."}
        </p>
      )}


      <form onSubmit={submit} className="mt-2 grid gap-1.5">
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Subcontractor company name"
          className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
        />
        <div>
          <div className="flex flex-wrap gap-1">
            {TRADE_PACKAGES.map((p) => {
              const on = packages.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePackage(p)}
                  className={`rounded-sm border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest transition ${
                    on
                      ? "border-alert bg-alert/20 text-alert"
                      : "border-white/15 text-foreground/60 hover:border-white/40"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !companyName.trim() || packages.length === 0}
          className="glass-orange inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.6rem] uppercase tracking-widest disabled:opacity-40"
        >
          <PlusCircle size={11} /> Generate Subcontractor Access
        </button>
      </form>

      {freshLink && (
        <div className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-400/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-emerald-300">
              Live Invite · {freshLink.company}
            </p>
            <button
              type="button"
              onClick={() => setFreshLink(null)}
              className="rounded-sm border border-white/20 p-1 text-foreground/60 hover:text-foreground"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="rounded-md bg-white p-2">
              <QRCodeSVG value={freshLink.url} size={128} level="M" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60">
                Invite Link
              </p>
              <div className="flex items-center gap-2 rounded-md border border-emerald-400/40 bg-black/70 px-2 py-1.5">
                <Link2 size={12} className="shrink-0 text-emerald-300" />
                <input
                  readOnly
                  value={freshLink.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full bg-transparent font-mono text-xs text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => copy(freshLink.url)}
                  className="inline-flex items-center gap-1 rounded-sm border border-emerald-400/60 bg-emerald-400/10 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-emerald-200 hover:bg-emerald-400/20"
                >
                  <Copy size={10} /> Copy
                </button>
              </div>
              <p className="mt-2 text-[0.65rem] text-foreground/60">
                Anyone opening this link becomes a subcontractor on this project and is routed
                directly to DABS.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-white/10 bg-black/40">
        {list.length === 0 && (
          <p className="p-3 text-center text-xs text-foreground/50">
            No subcontractors invited yet.
          </p>
        )}
        {list.map((inv: any) => {
          const status = inv.revoked_at
            ? { label: "Revoked", cls: "border-destructive/60 text-destructive-foreground" }
            : inv.accepted_at
              ? { label: "Accepted", cls: "border-emerald-400/50 text-emerald-300" }
              : new Date(inv.expires_at) < new Date()
                ? { label: "Expired", cls: "border-white/30 text-foreground/50" }
                : { label: "Pending", cls: "border-alert/60 text-alert" };
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 border-b border-white/8 px-2.5 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-foreground/90">{inv.company_name}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(inv.trade_packages ?? []).map((t: string) => (
                    <span
                      key={t}
                      className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${status.cls}`}
              >
                {status.label === "Accepted" && <Check size={10} />}
                {status.label}
              </span>
              <div className="flex items-center gap-1" title="Package Manager">
                <UserCog size={11} className="shrink-0 text-foreground/40" />
                <select
                  value={inv.package_manager_id ?? ""}
                  onChange={(e) => assignManager(inv.id, e.target.value || null)}
                  disabled={managers.length === 0}
                  className="rounded-sm border border-white/15 bg-black/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/80 outline-none focus:border-alert disabled:opacity-40"
                >
                  <option value="">Unassigned</option>
                  {managers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Unnamed"}
                    </option>
                  ))}
                </select>
              </div>
              {!inv.revoked_at && !inv.accepted_at && (
                <button
                  type="button"
                  onClick={() => revoke(inv.id)}
                  className="rounded-sm border border-destructive/60 p-1 text-destructive-foreground hover:bg-destructive/20"
                  title="Revoke"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
