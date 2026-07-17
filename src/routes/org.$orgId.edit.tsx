import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
} from "lucide-react";
import { getMyOrg, getOrgById, updateOrg } from "@/lib/orgs.functions";
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
      </div>
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
