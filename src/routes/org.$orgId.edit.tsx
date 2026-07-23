import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Hash,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  AlertCircle,
  Loader2,
  User,
  UserPlus,
  Copy,
  X,
  Check,
} from "lucide-react";
import {
  getMyOrg,
  getOrgById,
  updateOrg,
  listOrgInvites,
  inviteOrgMember,
  revokeOrgInvite,
  listOrgMembersFor,
  removeOrgMember,
  updateOrgMemberRole,
} from "@/lib/orgs.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";


export const Route = createFileRoute("/org/$orgId/edit")({
  head: () => ({ meta: [{ title: "Edit Organisation — instructSite" }] }),
  component: EditOrgPage,
});

function EditOrgPage() {
  const { orgId } = Route.useParams();
  const nav = useNavigate();
  const update = useServerFn(updateOrg);
  const orgFn = useServerFn(getMyOrg);
  const getOrgFn = useServerFn(getOrgById);

  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await ensureOracleSession();
        const me = await orgFn();
        const owner = me?.role === "owner";
        setIsOwner(owner);
        if (owner) {
          const o = await getOrgFn({ data: { orgId } });
          setName(o.name ?? "");
          setSlug(o.slug ?? "");
          setCompanyNumber(o.company_number ?? "");
          setContactName(o.contact_name ?? "");
          setContactEmail(o.contact_email ?? "");
          setContactPhone(o.contact_phone ?? "");
          setRegisteredAddress(o.registered_address ?? "");
          setNotes(o.notes ?? "");
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setIsOwner(false);
      } finally {
        setLoading(false);
        setReady(true);
      }
    })();
  }, [orgFn, getOrgFn, orgId]);

  const canSubmit = name.trim().length >= 2 && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      await update({
        data: {
          orgId,
          name: name.trim(),
          slug: slug.trim(),
          companyNumber: companyNumber.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          registeredAddress: registeredAddress.trim(),
          notes: notes.trim(),
        },
      });
      nav({ to: "/org/$orgId", params: { orgId } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <Link
          to="/org/$orgId"
          params={{ orgId }}
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-alert"
        >
          <ArrowLeft size={12} /> Back to Organisation
        </Link>
        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
          Founder Console
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Edit Organisation
        </h1>

        {isOwner === false ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-alert/50 bg-alert/10 p-4 text-sm text-foreground">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-alert" />
              <div>
                <p className="font-bold uppercase tracking-widest text-alert">Access denied</p>
                <p className="mt-1 text-foreground/80">
                  Only the account founder can edit an organisation.
                </p>
              </div>
            </div>
            <Link
              to="/org/$orgId"
              params={{ orgId }}
              className="glass-btn inline-flex rounded-xl px-4 py-2.5 text-sm uppercase tracking-wider"
            >
              Back to Organisation
            </Link>
          </div>
        ) : (
        <form onSubmit={submit} className="glass-panel mt-6 space-y-6 p-6">
          <Field label="Organisation Name" icon={<Building2 size={14} />} required>
            <input
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Slug (URL identifier)" icon={<Hash size={14} />}>
            <input
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={slug}
              maxLength={60}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
            />
            <p className="mt-1 text-[0.65rem] text-foreground/50">
              Changing this will affect existing invite links.
            </p>
          </Field>

          <Field label="Company Registration Number" icon={<Hash size={14} />}>
            <input
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={companyNumber}
              maxLength={60}
              onChange={(e) => setCompanyNumber(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary Contact Name" icon={<User size={14} />}>
              <input
                disabled={!isOwner}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
                value={contactName}
                maxLength={120}
                onChange={(e) => setContactName(e.target.value)}
              />
            </Field>
            <Field label="Contact Email" icon={<Mail size={14} />}>
              <input
                type="email"
                disabled={!isOwner}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
                value={contactEmail}
                maxLength={200}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Contact Phone" icon={<Phone size={14} />}>
            <input
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={contactPhone}
              maxLength={40}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </Field>

          <Field label="Registered Address" icon={<MapPin size={14} />}>
            <textarea
              rows={2}
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={registeredAddress}
              maxLength={500}
              onChange={(e) => setRegisteredAddress(e.target.value)}
            />
          </Field>

          <Field label="Notes" icon={<StickyNote size={14} />}>
            <textarea
              rows={3}
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-alert/50 bg-alert/10 p-3 text-sm text-foreground">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-alert" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              to="/org/$orgId"
              params={{ orgId }}
              className="glass-btn rounded-xl px-4 py-2.5 text-sm uppercase tracking-wider"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || !isOwner}
              className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
        )}

        {isOwner && <MembersPanel orgId={orgId} />}
      </div>
    </div>
  );
}

function MembersPanel({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listOrgInvites);
  const membersFn = useServerFn(listOrgMembersFor);
  const inviteFn = useServerFn(inviteOrgMember);
  const revokeFn = useServerFn(revokeOrgInvite);
  const removeFn = useServerFn(removeOrgMember);
  const updateRoleFn = useServerFn(updateOrgMemberRole);

  const invites = useQuery({
    queryKey: ["org-invites", orgId],
    queryFn: () => listFn({ data: { orgId } }),
  });
  const members = useQuery({
    queryKey: ["org-members-for", orgId],
    queryFn: () => membersFn({ data: { orgId } }),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "pm" | "subcontractor">("subcontractor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const pendingInvites = (invites.data ?? []).filter((i) => i.status === "pending");
  const stdAdminFilled =
    (members.data ?? []).some((m) => m.role === "admin") ||
    pendingInvites.some((i) => i.role === "admin" && i.is_standard);
  const stdPMFilled =
    (members.data ?? []).some((m) => m.role === "pm") ||
    pendingInvites.some((i) => i.role === "pm" && i.is_standard);
  const stdSubCount =
    (members.data ?? []).filter((m) => m.role === "subcontractor").length +
    pendingInvites.filter((i) => i.role === "subcontractor" && i.is_standard).length;
  const stdComplete = stdAdminFilled && stdPMFilled && stdSubCount >= 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await inviteFn({ data: { orgId, email: email.trim(), role } });
      setEmail("");
      invites.refetch();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await revokeFn({ data: { inviteId: id } });
    invites.refetch();
  }

  async function removeMember(id: string) {
    if (!window.confirm("Remove this member from the organisation?")) return;
    setRowBusy(id);
    try {
      await removeFn({ data: { memberId: id } });
      await members.refetch();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setRowBusy(null);
    }
  }

  async function changeRole(id: string, newRole: "admin" | "pm" | "subcontractor") {
    setRowBusy(id);
    try {
      await updateRoleFn({ data: { memberId: id, role: newRole } });
      await members.refetch();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setRowBusy(null);
    }
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/join-org/invite/${token}`;
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="glass-panel mt-8 space-y-6 p-6">
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          Members & Invites
        </p>
        <p className="mt-1 text-xs text-foreground/60">
          Standard seats: 1 Project Admin + 1 Project Manager (also Org Admin) + 2 Subcontractors. Additional
          members unlock once all 4 standard seats are used.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/60">
          Active Members
        </p>
        <div className="space-y-2">
          {(members.data ?? []).length === 0 && (
            <p className="text-xs text-foreground/50">No members joined yet.</p>
          )}
          {(members.data ?? []).map((m) => {
            const displayName =
              m.full_name?.trim() ||
              m.email ||
              `${m.user_id.slice(0, 8)}…`;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 p-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{displayName}</p>
                  {m.email && m.full_name && (
                    <p className="truncate text-[0.65rem] text-foreground/50">{m.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    disabled={rowBusy === m.id}
                    onChange={(e) =>
                      changeRole(m.id, e.target.value as "admin" | "pm" | "subcontractor")
                    }
                    className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-foreground outline-none focus:border-alert disabled:opacity-50"
                  >
                    <option value="admin">Project Admin</option>
                    <option value="pm">Project Manager / Org Admin</option>
                    <option value="subcontractor">Subcontractor</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    disabled={rowBusy === m.id}
                    className="inline-flex items-center gap-1 rounded-md border border-alert/40 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-alert hover:bg-alert/10 disabled:opacity-50"
                  >
                    <X size={11} /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      <div>
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/60">
          Pending Invites
        </p>
        <div className="space-y-2">
          {pendingInvites.length === 0 && (
            <p className="text-xs text-foreground/50">No pending invites.</p>
          )}
          {pendingInvites.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 p-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-foreground/80">{i.email}</span>
                <span className="rounded bg-alert/20 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-alert">
                  {i.role === "admin" ? "Org Admin" : i.role === "pm" ? "PM" : "Sub"}
                </span>
                {!i.is_standard && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/70">
                    Additional
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(i.token)}
                  className="glass-btn inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] uppercase tracking-widest"
                  title="Copy invite link"
                >
                  {copied === i.token ? <Check size={11} /> : <Copy size={11} />}
                  {copied === i.token ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => revoke(i.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-alert/40 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-alert hover:bg-alert/10"
                >
                  <X size={11} /> Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 border-t border-white/10 pt-4">
        <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-widest text-foreground/80">
          <UserPlus size={12} />
          {stdComplete ? "Invite Additional Member" : "Invite Standard Member"}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            placeholder="member@company.example"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "pm" | "subcontractor")}
            className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert"
          >
            <option value="admin">Organisation Admin</option>
            <option value="pm">Project Manager</option>
            <option value="subcontractor">Subcontractor</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
            Send Invite
          </button>
        </div>
        {err && (
          <p className="flex items-start gap-2 text-xs text-alert">
            <AlertCircle size={12} className="mt-0.5" /> {err}
          </p>
        )}
      </form>
    </div>
  );
}


function Field({
  label,
  icon,
  required,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-widest text-foreground/70">
        {icon} {label}
        {required && <span className="text-alert">*</span>}
      </span>
      {children}
    </label>
  );
}
