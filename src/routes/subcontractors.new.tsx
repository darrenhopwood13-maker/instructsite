import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Check, Building2, UserSquare2, HardHat, QrCode, ShieldCheck, Eye } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { listMyProjects } from "@/lib/projects.functions";
import { createSubcontractorInvite } from "@/lib/subcontractors.functions";
import { getSubcontractorSeatUsage } from "@/lib/subscriptions.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/subcontractors/new")({
  head: () => ({
    meta: [
      { title: "Register Trade Partner · Subcontractor Registry" },
      {
        name: "description",
        content:
          "Enroll a new contracted trade partner with corporate profile, PM and site supervisor contacts, and generate secure onboarding tokens.",
      },
    ],
  }),
  component: RegisterPartnerPage,
});

const TRADE_OPTIONS = [
  "Groundworks",
  "Concrete Frame",
  "Steel Frame",
  "Cladding",
  "Roofing",
  "Windows & Curtain Wall",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Drylining & Plaster",
  "Joinery & Carpentry",
  "Painting & Decorating",
  "Flooring",
  "Ceilings",
  "Lifts",
  "Fire Protection",
  "Landscaping",
  "Demolition",
  "Scaffolding",
  "Cleaning",
];

interface FormState {
  projectId: string;
  companyName: string;
  tradePackage: string;
  seatRole: "admin" | "read_only";
  registeredAddress: string;
  officePhone: string;
  corporateEmail: string;
  pmName: string;
  pmMobile: string;
  pmEmail: string;
  supervisorName: string;
  supervisorMobile: string;
  supervisorEmail: string;
}

const EMPTY: FormState = {
  projectId: "",
  companyName: "",
  tradePackage: "",
  seatRole: "admin",
  registeredAddress: "",
  officePhone: "",
  corporateEmail: "",
  pmName: "",
  pmMobile: "",
  pmEmail: "",
  supervisorName: "",
  supervisorMobile: "",
  supervisorEmail: "",
};

function RegisterPartnerPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const listFn = useServerFn(listMyProjects);
  const createFn = useServerFn(createSubcontractorInvite);
  const seatFn = useServerFn(getSubcontractorSeatUsage);

  const projects = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => listFn(),
    enabled: ready,
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ token: string; expiresAt: string; company: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const rows = projects.data ?? [];
  useEffect(() => {
    if (!form.projectId && rows.length) setForm((f) => ({ ...f, projectId: rows[0].id }));
  }, [rows, form.projectId]);

  // Seat usage lookup: only queries once a project + company are picked.
  const seats = useQuery({
    queryKey: ["seat-usage", form.projectId, form.companyName.trim().toLowerCase()],
    enabled: ready && !!form.projectId && form.companyName.trim().length >= 2,
    queryFn: () =>
      seatFn({
        data: {
          projectId: form.projectId,
          companyName: form.companyName.trim(),
        },
      }),
    staleTime: 15_000,
  });

  const seatData = seats.data ?? {
    adminUsed: 0,
    readonlyUsed: 0,
    adminCap: 1,
    readonlyCap: 2,
    totalCap: 3,
  };
  const adminFull = seatData.adminUsed >= seatData.adminCap;
  const readonlyFull = seatData.readonlyUsed >= seatData.readonlyCap;
  const capFull = adminFull && readonlyFull;

  const inviteUrl = useMemo(() => {
    if (!result) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${result.token}`;
  }, [result]);

  const setField = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId) return toast.error("Select a project first.");
    if (!form.companyName.trim()) return toast.error("Company name is required.");
    if (!form.tradePackage) return toast.error("Select a trade package.");
    if (capFull) return toast.error("Maximum Capacity Reached · 3 seats per subcontractor.");
    if (form.seatRole === "admin" && adminFull) {
      return toast.error("Admin seat already assigned — pick Read-Only.");
    }
    if (form.seatRole === "read_only" && readonlyFull) {
      return toast.error("Read-only seats full — pick Admin (if free).");
    }
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          projectId: form.projectId,
          companyName: form.companyName.trim(),
          tradePackages: [form.tradePackage],
          seatRole: form.seatRole,
          registeredAddress: form.registeredAddress,
          officePhone: form.officePhone,
          corporateEmail: form.corporateEmail,
          pmName: form.pmName,
          pmMobile: form.pmMobile,
          pmEmail: form.pmEmail,
          supervisorName: form.supervisorName,
          supervisorMobile: form.supervisorMobile,
          supervisorEmail: form.supervisorEmail,
        },
      });
      setResult({ token: res.token, expiresAt: res.expiresAt, company: form.companyName.trim() });
      toast.success("Partner registered · access tokens generated.");
      seats.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const resetForNext = () => {
    setResult(null);
    setForm((f) => ({ ...EMPTY, projectId: f.projectId }));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f3ee] text-neutral-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={12} /> Back to Projects
        </Link>

        <header className="mt-4 border-b-2 border-neutral-900/90 pb-6">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.4em] text-neutral-500">
            Subcontractor Registry
          </p>
          <h1
            className="mt-2 text-4xl font-black tracking-tight text-neutral-900 md:text-5xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Register New Contracted Trade Partner
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Capture the full corporate profile, project management, and site supervision contacts. On save
            we generate a secure onboarding link and QR code for the site supervisor to access their mobile cockpit.
          </p>
        </header>

        {result ? (
          <SuccessPane
            company={result.company}
            inviteUrl={inviteUrl}
            expiresAt={result.expiresAt}
            copied={copied}
            onCopy={copy}
            onNext={resetForNext}
          />
        ) : (
          <form onSubmit={submit} className="mt-8">
            <ProjectSelect
              value={form.projectId}
              onChange={(v) => setField("projectId", v)}
              options={rows.map((r: any) => ({ id: r.id, name: r.name }))}
              disabled={!ready || busy}
            />

            {form.companyName.trim().length >= 2 && (
              <SeatCapacityBar
                company={form.companyName.trim()}
                adminUsed={seatData.adminUsed}
                readonlyUsed={seatData.readonlyUsed}
                capFull={capFull}
                seatRole={form.seatRole}
                onSeatRole={(v) => setField("seatRole", v)}
                adminFull={adminFull}
                readonlyFull={readonlyFull}
              />
            )}


            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Section
                icon={<Building2 size={16} />}
                title="Corporate Profile"
                subtitle="Section A"
              >
                <Field
                  label="Company Name"
                  value={form.companyName}
                  onChange={(v) => setField("companyName", v)}
                  required
                />
                <SelectField
                  label="Trade Package"
                  value={form.tradePackage}
                  onChange={(v) => setField("tradePackage", v)}
                  options={TRADE_OPTIONS}
                  required
                />
                <Field
                  label="Registered Business Address"
                  value={form.registeredAddress}
                  onChange={(v) => setField("registeredAddress", v)}
                  multiline
                />
                <Field
                  label="Office Phone"
                  value={form.officePhone}
                  onChange={(v) => setField("officePhone", v)}
                  type="tel"
                />
                <Field
                  label="Corporate Email"
                  value={form.corporateEmail}
                  onChange={(v) => setField("corporateEmail", v)}
                  type="email"
                />
              </Section>

              <Section
                icon={<UserSquare2 size={16} />}
                title="Project Management"
                subtitle="Section B"
              >
                <Field
                  label="PM Full Name"
                  value={form.pmName}
                  onChange={(v) => setField("pmName", v)}
                />
                <Field
                  label="PM Mobile"
                  value={form.pmMobile}
                  onChange={(v) => setField("pmMobile", v)}
                  type="tel"
                />
                <Field
                  label="PM Email"
                  value={form.pmEmail}
                  onChange={(v) => setField("pmEmail", v)}
                  type="email"
                />
              </Section>

              <Section
                icon={<HardHat size={16} />}
                title="Site Supervision"
                subtitle="Section C"
              >
                <Field
                  label="Supervisor Full Name"
                  value={form.supervisorName}
                  onChange={(v) => setField("supervisorName", v)}
                />
                <Field
                  label="Supervisor Mobile"
                  value={form.supervisorMobile}
                  onChange={(v) => setField("supervisorMobile", v)}
                  type="tel"
                />
                <Field
                  label="Supervisor Email"
                  value={form.supervisorEmail}
                  onChange={(v) => setField("supervisorEmail", v)}
                  type="email"
                />
              </Section>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t-2 border-neutral-900/90 pt-6">
              <Link
                to="/projects"
                className="rounded-md border-2 border-neutral-900 bg-white px-5 py-3 text-[0.7rem] font-bold uppercase tracking-[0.28em] text-neutral-900 shadow-[3px_3px_0_0_rgba(15,23,42,0.15)] hover:bg-neutral-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md border-2 border-[#1d3f8a] bg-[#1d3f8a] px-6 py-3 text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-white shadow-[4px_4px_0_0_rgba(15,23,42,0.35)] transition hover:brightness-110 disabled:opacity-50"
              >
                <QrCode size={14} />
                {busy ? "Saving…" : "Save Partner & Generate Access Tokens"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function ProjectSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block rounded-lg border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-neutral-500">
        Assigned Project
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full bg-transparent text-lg font-bold text-neutral-900 focus:outline-none disabled:opacity-50"
      >
        {options.length === 0 && <option value="">No projects available</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col rounded-lg border-2 border-neutral-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2 text-neutral-900">
          <span className="grid h-7 w-7 place-items-center rounded-sm border-2 border-neutral-900 bg-neutral-50">
            {icon}
          </span>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]">{title}</h2>
        </div>
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.32em] text-neutral-400">
          {subtitle}
        </span>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  const base =
    "mt-1.5 w-full rounded-md border-2 border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none";
  return (
    <label className="block">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-neutral-500">
        {label}
        {required && <span className="ml-1 text-[#c0392b]">*</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={base}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={base}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-neutral-500">
        {label}
        {required && <span className="ml-1 text-[#c0392b]">*</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1.5 w-full rounded-md border-2 border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
      >
        <option value="">Select a trade…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SuccessPane({
  company,
  inviteUrl,
  expiresAt,
  copied,
  onCopy,
  onNext,
}: {
  company: string;
  inviteUrl: string;
  expiresAt: string;
  copied: boolean;
  onCopy: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-lg border-2 border-neutral-900 bg-white p-8 shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-emerald-600">
          Partner Registered
        </p>
        <h2
          className="mt-2 text-3xl font-black text-neutral-900"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          {company}
        </h2>
        <p className="mt-3 text-sm text-neutral-600">
          Share the onboarding link or let the site supervisor scan the QR code to open their mobile cockpit
          and log daily activity.
        </p>

        <div className="mt-6">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-neutral-500">
            Onboarding Invite Link
          </span>
          <div className="mt-2 flex items-stretch overflow-hidden rounded-md border-2 border-neutral-900">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 bg-neutral-50 px-3 py-2.5 font-mono text-xs text-neutral-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 border-l-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-white hover:bg-neutral-800"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[0.65rem] uppercase tracking-widest text-neutral-400">
            Expires {new Date(expiresAt).toLocaleString()}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onNext}
            className="rounded-md border-2 border-neutral-900 bg-white px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-neutral-900 hover:bg-neutral-50"
          >
            Register Another Partner
          </button>
          <Link
            to="/projects"
            className="rounded-md border-2 border-[#1d3f8a] bg-[#1d3f8a] px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-white shadow-[3px_3px_0_0_rgba(15,23,42,0.25)] hover:brightness-110"
          >
            Back to Projects
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-neutral-900 bg-white p-8 shadow-[4px_4px_0_0_rgba(15,23,42,0.15)]">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-neutral-500">
          Supervisor QR Access
        </p>
        <div className="mt-4 rounded-md border-2 border-neutral-900 bg-white p-4">
          <QRCodeSVG value={inviteUrl} size={200} level="H" includeMargin={false} />
        </div>
        <p className="mt-4 text-center text-xs text-neutral-500">
          Scan with the supervisor's phone camera to open the mobile cockpit.
        </p>
      </div>
    </div>
  );
}
