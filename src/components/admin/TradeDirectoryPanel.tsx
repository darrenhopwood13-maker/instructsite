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
  inviteQs,
  listProjectQs,
  inviteProjectAdmin,
  listProjectAdmins,
} from "@/lib/subcontractors.functions";
import { designateSubcontractorPmSeat } from "@/lib/subcontractors.functions";
import { formatSentDate, daysAgo, expiryCountdown } from "@/lib/invite-format";
import { errorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { getMyRoles } from "@/lib/projects.functions";

import { TRADE_PACKAGES } from "@/lib/trade-packages";
import { TradePackageChips } from "@/components/project/TradePackageField";


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
  const designatePmFn = useServerFn(designateSubcontractorPmSeat);
  const refreshInviteFn = useServerFn(refreshSubcontractorInvite);
  const inviteManagerFn = useServerFn(inviteSiteManager);
  const rolesFn = useServerFn(getMyRoles);
  const inviteQsFn = useServerFn(inviteQs);
  const projectQsFn = useServerFn(listProjectQs);
  const inviteProjectAdminFn = useServerFn(inviteProjectAdmin);
  const projectAdminsFn = useServerFn(listProjectAdmins);
  const qc = useQueryClient();

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    retry: false,
  });
  const roles = rolesQ.data?.roles ?? [];
  const isAdmin = roles.includes("master_admin") || roles.includes("project_admin");


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

  // --- Project Admin invites (admin only) ---------------------------------
  const projectAdmins = useQuery({
    queryKey: ["project-admins", projectId],
    queryFn: () => projectAdminsFn({ data: { projectId } }),
    enabled: ready && isAdmin,
    retry: false,
  });

  const [paEmail, setPaEmail] = useState("");
  const [paName, setPaName] = useState("");
  const [invitingPa, setInvitingPa] = useState(false);
  const [showPaInvite, setShowPaInvite] = useState(false);

  const inviteAProjectAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paEmail.trim() || invitingPa) return;
    setInvitingPa(true);
    try {
      const res = await inviteProjectAdminFn({
        data: { projectId, email: paEmail.trim(), fullName: paName.trim() || null },
      });
      qc.invalidateQueries({ queryKey: ["project-admins", projectId] });
      setPaEmail("");
      setPaName("");
      if ("alreadyInvited" in res && res.alreadyInvited) {
        toast.success("That person is already a Project Admin on this project.");
      } else if (res.attached) {
        toast.success("Project Admin invited and added to this project.");
      } else if (res.emailed) {
        toast.success("Invite emailed — they join the project once they sign in.");
      } else {
        toast.error(res.emailError ?? "Could not send that invite.");
      }
    } catch (e2) {
      toast.error(errorMessage(e2, "Could not invite that Project Admin."));
    } finally {
      setInvitingPa(false);
    }
  };

  // --- Quantity Surveyor invites (admin only) -----------------------------
  const projectQs = useQuery({
    queryKey: ["project-qs", projectId],
    queryFn: () => projectQsFn({ data: { projectId } }),
    enabled: ready && isAdmin,
    retry: false,
  });

  const [qsEmail, setQsEmail] = useState("");
  const [qsName, setQsName] = useState("");
  const [invitingQs, setInvitingQs] = useState(false);
  const [showQsInvite, setShowQsInvite] = useState(false);

  const inviteAQs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qsEmail.trim() || invitingQs) return;
    setInvitingQs(true);
    try {
      const res = await inviteQsFn({
        data: { projectId, email: qsEmail.trim(), fullName: qsName.trim() || null },
      });
      qc.invalidateQueries({ queryKey: ["project-qs", projectId] });
      setQsEmail("");
      setQsName("");
      if ("alreadyInvited" in res && res.alreadyInvited) {
        toast.success("That person is already a Quantity Surveyor on this project.");
      } else if (res.attached) {
        toast.success("Quantity Surveyor invited and added to this project.");
      } else if (res.emailed) {
        toast.success("Invite emailed — they join the project once they sign in.");
      } else {
        toast.error(res.emailError ?? "Could not send that invite.");
      }
    } catch (e2) {
      toast.error(errorMessage(e2, "Could not invite that Quantity Surveyor."));
    } finally {
      setInvitingQs(false);
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [packages, setPackages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [freshLink, setFreshLink] = useState<{ url: string; company: string } | null>(null);

  const togglePackage = (p: string) =>
    setPackages((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !inviteEmail.trim() || packages.length === 0) return;
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          projectId,
          companyName: companyName.trim(),
          tradePackages: packages,
          corporateEmail: inviteEmail.trim(),
        },
      });
      const url = `${window.location.origin}/invite/${res.token}`;
      setFreshLink({ url, company: companyName.trim() });
      setCompanyName("");
      setInviteEmail("");
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

  const designatePm = async (inviteId: string, company: string) => {
    try {
      setRowBusy(inviteId);
      await designatePmFn({ data: { inviteId } });
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success(`PM seat designated for ${company}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not designate the PM seat.");
    } finally {
      setRowBusy(null);
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
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <Link
              to="/subcontractors/new"
              search={{ projectId } as any}
              className="inline-flex items-center gap-1.5 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 text-alert transition hover:bg-alert/20"
            >
              <Building2 size={10} />
              <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.2em]">
                Register Trade Partner
              </span>
              <ArrowRight size={10} />
            </Link>
            <Link
              to="/subcontractor-pack/$projectId/manager"
              params={{ projectId }}
              className="inline-flex items-center gap-1.5 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 text-alert transition hover:bg-alert/20"
            >
              <HardHat size={10} />
              <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.2em]">
                Full Registry
              </span>
              <ArrowRight size={10} />
            </Link>
          </div>
        )}
      </div>

      <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-foreground/60">
            <UserCog size={10} />{" "}
            {managers.length > 0 ? "Site Managers" : "Project Leads"} ({managers.length})
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowManagerInvite((open) => !open)}
            className="h-7 border-alert/60 bg-alert/10 px-2 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert hover:bg-alert/20 hover:text-alert"
          >
            <UserPlus size={11} /> Invite a Site Manager
          </Button>
        </div>
        {siteManagers.isError && (
          <p className="mt-1 rounded-sm border border-destructive/50 bg-destructive/10 px-1.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-destructive-foreground">
            {(siteManagers.error as Error)?.message ?? "Failed to load site managers."}
          </p>
        )}
        {unassignedManagers.isLoading ? (
          <p className="mt-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
            Loading eligible Site Managers…
          </p>
        ) : (unassignedManagers.data ?? []).length > 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <select
              value={pickedManagerId}
              onChange={(e) => setPickedManagerId(e.target.value)}
              className="min-w-0 flex-1 rounded-sm border border-white/15 bg-black/50 px-1.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/80 outline-none focus:border-alert"
            >
              <option value="">Add a Site Manager…</option>
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
        ) : showManagerInvite ? (
          <form onSubmit={inviteAManager} className="mt-1.5 grid gap-1.5">
            <input
              type="email"
              required
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder="site.manager@company.co.uk"
              className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
            />
            <input
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Full name (optional)"
              className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={invitingManager || !managerEmail.trim()}
                className="flex-1 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert transition hover:bg-alert/20 disabled:opacity-40"
              >
                {invitingManager ? "Sending…" : "Send Invite"}
              </button>
              <button
                type="button"
                onClick={() => setShowManagerInvite(false)}
                className="rounded-sm border border-white/20 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <p className="text-[0.6rem] leading-snug text-foreground/50">
              They receive a secure sign-in link and are added to this project as a Site
              Manager, so they can be picked as a Package Manager below.
            </p>
          </form>
        ) : (
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-sm border border-alert/30 bg-alert/5 px-2 py-1.5">
            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60">
              No unassigned Site Managers found
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowManagerInvite(true)}
              className="h-7 shrink-0 bg-alert px-2 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert-foreground hover:bg-alert/90"
            >
              <Mail size={10} /> Invite Now
            </Button>
          </div>
        )}
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

      {isAdmin && (
        <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-foreground/60">
              <UserCog size={10} /> Project Admins ({(projectAdmins.data ?? []).length})
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPaInvite((open) => !open)}
              className="h-7 border-alert/60 bg-alert/10 px-2 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert hover:bg-alert/20 hover:text-alert"
            >
              <UserPlus size={11} /> Invite a Project Admin
            </Button>
          </div>
          {projectAdmins.isError && (
            <p className="mt-1 rounded-sm border border-destructive/50 bg-destructive/10 px-1.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-destructive-foreground">
              {(projectAdmins.error as Error)?.message ?? "Failed to load project admins."}
            </p>
          )}
          {showPaInvite && (
            <form onSubmit={inviteAProjectAdmin} className="mt-1.5 grid gap-1.5">
              <input
                type="email"
                required
                value={paEmail}
                onChange={(e) => setPaEmail(e.target.value)}
                placeholder="project.admin@company.co.uk"
                className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
              <input
                value={paName}
                onChange={(e) => setPaName(e.target.value)}
                placeholder="Full name (optional)"
                className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={invitingPa || !paEmail.trim()}
                  className="flex-1 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert transition hover:bg-alert/20 disabled:opacity-40"
                >
                  {invitingPa ? "Sending…" : "Send Invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaInvite(false)}
                  className="rounded-sm border border-white/20 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60 hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[0.6rem] leading-snug text-foreground/50">
                They receive a secure sign-in link and get full admin control of this
                project alongside you.
              </p>
            </form>
          )}
          {(projectAdmins.data ?? []).length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(projectAdmins.data ?? []).map((m) => (
                <span
                  key={m.user_id}
                  className="rounded-sm border border-white/15 px-1 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest text-foreground/70"
                >
                  {m.full_name ?? "Unnamed"}
                  {m.email ? ` · ${m.email}` : ""}
                </span>
              ))}
            </div>
          ) : (
            !showPaInvite && (
              <p className="mt-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                No additional Project Admins on this project yet
              </p>
            )
          )}
        </div>
      )}

      {isAdmin && (
        <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-foreground/60">
              <UserCog size={10} /> Quantity Surveyors ({(projectQs.data ?? []).length})
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowQsInvite((open) => !open)}
              className="h-7 border-alert/60 bg-alert/10 px-2 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert hover:bg-alert/20 hover:text-alert"
            >
              <UserPlus size={11} /> Invite a QS
            </Button>
          </div>
          {projectQs.isError && (
            <p className="mt-1 rounded-sm border border-destructive/50 bg-destructive/10 px-1.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-destructive-foreground">
              {(projectQs.error as Error)?.message ?? "Failed to load quantity surveyors."}
            </p>
          )}
          {showQsInvite && (
            <form onSubmit={inviteAQs} className="mt-1.5 grid gap-1.5">
              <input
                type="email"
                required
                value={qsEmail}
                onChange={(e) => setQsEmail(e.target.value)}
                placeholder="quantity.surveyor@company.co.uk"
                className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
              <input
                value={qsName}
                onChange={(e) => setQsName(e.target.value)}
                placeholder="Full name (optional)"
                className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={invitingQs || !qsEmail.trim()}
                  className="flex-1 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert transition hover:bg-alert/20 disabled:opacity-40"
                >
                  {invitingQs ? "Sending…" : "Send Invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQsInvite(false)}
                  className="rounded-sm border border-white/20 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60 hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[0.6rem] leading-snug text-foreground/50">
                They receive a secure sign-in link and are added to this project as a
                Quantity Surveyor, so they can verify diary claims.
              </p>
            </form>
          )}
          {(projectQs.data ?? []).length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(projectQs.data ?? []).map((m) => (
                <span
                  key={m.user_id}
                  className="rounded-sm border border-white/15 px-1 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest text-foreground/70"
                >
                  {m.full_name ?? "Unnamed"}
                  {m.email ? ` · ${m.email}` : ""}
                </span>
              ))}
            </div>
          ) : (
            !showQsInvite && (
              <p className="mt-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                No Quantity Surveyors on this project yet
              </p>
            )
          )}
        </div>
      )}

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
        <input
          type="email"
          required
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="Invited contact email"
          className="rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
        />
        <TradePackageChips
          projectId={projectId}
          value={packages}
          onChange={setPackages}
          fallbackOptions={TRADE_PACKAGES}
        />

        <button
          type="submit"
          disabled={busy || !companyName.trim() || !inviteEmail.trim() || packages.length === 0}
          className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.6rem] uppercase tracking-widest disabled:opacity-40"
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
          const pending = !inv.revoked_at && !inv.accepted_at;
          const inviteEmail =
            inv.corporate_email || inv.pm_email || inv.supervisor_email || null;
          const expiry = expiryCountdown(inv.expires_at);
          const busyRow = rowBusy === inv.id;
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
              className="flex flex-wrap items-start justify-between gap-2 border-b border-white/8 px-2.5 py-2 last:border-b-0"
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
                {pending && (
                  <div className="mt-1.5 rounded-sm border border-alert/25 bg-alert/5 p-1.5">
                    <p className="mb-1 font-mono text-[0.5rem] font-bold uppercase tracking-widest text-alert">
                      Pending invite details
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.55rem] text-foreground/70">
                    <span className="inline-flex items-center gap-1">
                      <Mail size={9} />
                      {inviteEmail ?? "No contact email on file"}
                    </span>
                    <span>Sent {formatSentDate(inv.created_at)} · {daysAgo(inv.created_at)}</span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        expiry.expired
                          ? "text-destructive-foreground"
                          : expiry.urgent
                            ? "text-alert"
                            : "text-foreground/55"
                      }`}
                    >
                      <Clock size={9} />
                      {expiry.label}
                    </span>
                    </div>
                  </div>
                )}
                {pending && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyInviteLink(inv.id)}
                      disabled={busyRow}
                      className="inline-flex items-center gap-1 rounded-sm border border-emerald-400/50 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                    >
                      <Copy size={9} /> Copy Invite Link
                    </button>
                    <button
                      type="button"
                      onClick={() => resendInvite(inv.id)}
                      disabled={busyRow || !inviteEmail}
                      title={
                        inviteEmail
                          ? `Resend to ${inviteEmail}`
                          : "No contact email on this invite — copy the link instead"
                      }
                      className="inline-flex items-center gap-1 rounded-sm border border-alert/50 bg-alert/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-alert transition hover:bg-alert/20 disabled:opacity-40"
                    >
                      <RefreshCw size={9} className={busyRow ? "animate-spin" : ""} /> Resend Invite
                    </button>
                  </div>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${status.cls}`}
              >
                {status.label === "Accepted" && <Check size={10} />}
                {status.label}
              </span>
              {inv.seat_role === "pm" ? (
                <span
                  title="Holds the PM seat — the only seat that can counter-sign a short-term programme"
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-sky-400/60 bg-sky-400/10 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-sky-200"
                >
                  <UserCog size={9} /> PM Seat
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <span className="rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/55">
                    {inv.seat_role === "read_only" ? "Read-Only" : "Admin"}
                  </span>
                  {isAdmin && !inv.revoked_at && (
                    <button
                      type="button"
                      onClick={() => designatePm(inv.id, inv.company_name)}
                      disabled={busyRow}
                      title="Make this seat the company's PM for this project"
                      className="rounded-sm border border-sky-400/50 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-40"
                    >
                      Make PM
                    </button>
                  )}
                </span>
              )}
              {managers.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowManagerInvite(true)}
                  title="No Site Manager on this project yet"
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-alert/50 bg-alert/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-alert transition hover:bg-alert/20"
                >
                  <UserPlus size={9} /> Invite a Site Manager
                </button>
              ) : (
                <div className="flex items-center gap-1" title="Package Manager">
                  <UserCog size={11} className="shrink-0 text-foreground/40" />
                  <select
                    value={inv.package_manager_id ?? ""}
                    onChange={(e) => assignManager(inv.id, e.target.value || null)}
                    className="rounded-sm border border-white/15 bg-black/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/80 outline-none focus:border-alert"
                  >
                    <option value="">Unassigned</option>
                    {managers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name ?? "Unnamed"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
