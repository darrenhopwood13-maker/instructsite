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
  UserPlus,
  HardHat,
} from "lucide-react";
import { createOrg, getMyOrg } from "@/lib/orgs.functions";
import { slugify } from "@/lib/owner";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";


export const Route = createFileRoute("/org/new")({
  head: () => ({ meta: [{ title: "New Organisation — instructSite" }] }),
  component: NewOrgPage,
});

function NewOrgPage() {
  const nav = useNavigate();
  const create = useServerFn(createOrg);
  const orgFn = useServerFn(getMyOrg);

  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [companyNumber, setCompanyNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pmEmail, setPmEmail] = useState("");
  const [sub1Email, setSub1Email] = useState("");
  const [sub2Email, setSub2Email] = useState("");


  useEffect(() => {
    (async () => {
      try {
        await ensureOracleSession();
        const me = await orgFn();
        setIsOwner(me?.role === "owner");
      } catch {
        setIsOwner(false);
      } finally {
        setReady(true);
      }
    })();
  }, [orgFn]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const canSubmit = name.trim().length >= 2 && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      const invites: { email: string; role: "admin" | "subcontractor" }[] = [];
      if (pmEmail.trim()) invites.push({ email: pmEmail.trim(), role: "admin" });
      if (sub1Email.trim()) invites.push({ email: sub1Email.trim(), role: "subcontractor" });
      if (sub2Email.trim()) invites.push({ email: sub2Email.trim(), role: "subcontractor" });

      const { orgId } = await create({
        data: {
          name: name.trim(),
          slug: slug.trim(),
          companyNumber: companyNumber.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          registeredAddress: registeredAddress.trim(),
          notes: notes.trim(),
          invites,
        },
      });
      nav({ to: "/org/$orgId", params: { orgId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      setErr(msg || "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <Link
          to="/org"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-alert"
        >
          <ArrowLeft size={12} /> Back to Organisations
        </Link>
        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
          Founder Console
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          New Organisation
        </h1>
        <p className="mt-2 max-w-xl text-sm text-foreground/60">
          Create a fully-isolated organisation. Its projects, members and data will be scoped only to
          this org.
        </p>

        {ready && isOwner === false && (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-alert/50 bg-alert/10 p-4 text-sm text-foreground">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-alert" />
            <div>
              <p className="font-bold uppercase tracking-widest text-alert">Access denied</p>
              <p className="mt-1 text-foreground/80">Only the founder can create organisations.</p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="glass-panel mt-6 space-y-6 p-6">
          <Field label="Organisation Name" icon={<Building2 size={14} />} required>
            <input
              autoFocus
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="e.g. BuildCo Construction Ltd"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Slug (URL identifier)" icon={<Hash size={14} />}>
            <input
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="auto-generated from name"
              value={slug}
              maxLength={60}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSlugTouched(true);
              }}
            />
            <p className="mt-1 text-[0.65rem] text-foreground/50">
              Used in invite links. Auto-adjusted if taken.
            </p>
          </Field>

          <Field label="Company Registration Number" icon={<Hash size={14} />}>
            <input
              disabled={!isOwner}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="e.g. 12345678"
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
                placeholder="e.g. Jane Smith"
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
                placeholder="contact@buildco.example"
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
              placeholder="+44…"
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
              placeholder="Street, city, postcode"
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
              placeholder="Internal notes (visible only to the founder)"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <p className="mb-1 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-widest text-alert">
              <UserPlus size={14} /> Invite Standard Members
            </p>
            <p className="mb-4 text-[0.7rem] text-foreground/60">
              Every organisation has 3 standard seats: 1 Project Manager + 2 Subcontractors.
              Emails are optional — you can send invites later from the edit page.
            </p>

            <label className="mb-3 block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
                <User size={12} /> Project Manager Email
              </span>
              <input
                type="email"
                disabled={!isOwner}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert disabled:opacity-50"
                placeholder="pm@company.example"
                value={pmEmail}
                onChange={(e) => setPmEmail(e.target.value)}
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
                <HardHat size={12} /> Subcontractor 1 Email
              </span>
              <input
                type="email"
                disabled={!isOwner}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert disabled:opacity-50"
                placeholder="sub1@company.example"
                value={sub1Email}
                onChange={(e) => setSub1Email(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70">
                <HardHat size={12} /> Subcontractor 2 Email
              </span>
              <input
                type="email"
                disabled={!isOwner}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert disabled:opacity-50"
                placeholder="sub2@company.example"
                value={sub2Email}
                onChange={(e) => setSub2Email(e.target.value)}
              />
            </label>
          </div>



          {err && (
            <div className="flex items-start gap-2 rounded-md border border-alert/50 bg-alert/10 p-3 text-sm text-foreground">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-alert" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              to="/org"
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
                  <Loader2 size={14} className="animate-spin" /> Creating…
                </>
              ) : (
                "Create Organisation"
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
