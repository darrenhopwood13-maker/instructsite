import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Building2, MapPin, FileText } from "lucide-react";
import { createProject, getMyRoles } from "@/lib/projects.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [{ title: "New Project — Site Operations Oracle" }],
  }),
  component: NewProject,
});

const STEPS = ["Details", "Admins", "Review"] as const;

function NewProject() {
  const nav = useNavigate();
  const create = useServerFn(createProject);
  const rolesFn = useServerFn(getMyRoles);

  const [step, setStep] = useState(0);
  const [uid, setUid] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    siteAddress: "",
    scopeBrief: "",
  });

  useEffect(() => {
    (async () => {
      const u = await ensureOracleSession();
      setUid(u.id);
      const r = await rolesFn();
      setIsMaster(r.roles.includes("master_admin"));
    })();
  }, [rolesFn]);

  const canNext =
    (step === 0 && form.name.trim() && form.siteAddress.trim()) ||
    step === 1 ||
    step === 2;

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const { id } = await create({
        data: {
          name: form.name.trim(),
          siteAddress: form.siteAddress.trim(),
          scopeBrief: form.scopeBrief.trim(),
        },
      });
      nav({ to: "/projects/$projectId", params: { projectId: id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create project");
      setSaving(false);
    }
  };

  if (isMaster === false) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-foreground">Access denied</h1>
        <p className="mt-3 text-foreground/70">
          Only Master Admins can onboard new projects.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">Onboarding</p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          New Project Setup
        </h1>

        {/* Stepper */}
        <ol className="mt-8 grid grid-cols-3 gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2 border-b-2 pb-2 text-[0.7rem] font-bold uppercase tracking-widest ${
                i <= step ? "border-alert text-foreground" : "border-white/10 text-foreground/40"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border ${
                  i < step
                    ? "border-alert bg-alert text-black"
                    : i === step
                      ? "border-alert text-alert"
                      : "border-white/20 text-foreground/40"
                }`}
              >
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <div className="glass-panel mt-6 p-6">
          {step === 0 && (
            <div className="space-y-5">
              <Field label="Project Name" icon={<Building2 size={14} />}>
                <input
                  autoFocus
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert"
                  placeholder="e.g. Riverside Tower Phase 2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Full Site Address" icon={<MapPin size={14} />}>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert"
                  placeholder="Street, city, postcode"
                  value={form.siteAddress}
                  onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
                />
              </Field>
              <Field label="Project Brief / Scope of Works" icon={<FileText size={14} />}>
                <textarea
                  rows={5}
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert"
                  placeholder="Scope, contract value, key trades, high-risk activities, key dates…"
                  value={form.scopeBrief}
                  onChange={(e) => setForm({ ...form, scopeBrief: e.target.value })}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 text-sm text-foreground/80">
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-alert">
                Master Admin Assignment
              </p>
              <div className="rounded-md border border-white/15 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-widest text-foreground/50">
                  Master Admin
                </p>
                <p className="mt-1 font-mono text-sm text-foreground">You ({uid?.slice(0, 8)}…)</p>
                <p className="mt-2 text-xs text-foreground/60">
                  Master Admins can create projects, assign Project Admins, and manage all documents.
                </p>
              </div>
              <div className="rounded-md border border-white/15 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-widest text-foreground/50">
                  Project Admin
                </p>
                <p className="mt-1 font-mono text-sm text-foreground">You ({uid?.slice(0, 8)}…)</p>
                <p className="mt-2 text-xs text-foreground/60">
                  Project Admins own drawings, logistics, RAMS, and permit approvals for a single project. You can reassign after onboarding.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm">
              <Row label="Project" value={form.name} />
              <Row label="Site Address" value={form.siteAddress} />
              <Row label="Brief" value={form.scopeBrief || "—"} />
              <Row label="Master Admin" value={`You (${uid?.slice(0, 8)}…)`} />
              <Row label="Project Admin" value={`You (${uid?.slice(0, 8)}…)`} />
              <p className="pt-2 text-xs text-foreground/60">
                After creation you'll upload GA Drawings, the Site Logistics Plan, and Master RAMS.
              </p>
              {err && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive-foreground">
                  {err}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="glass-btn rounded-xl px-4 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
            >
              Back
            </button>
            {step < 2 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep((s) => Math.min(2, s + 1))}
                className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
              >
                {saving ? "Creating…" : "Create Project"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-widest text-foreground/70">
        {icon} {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-white/10 py-2">
      <span className="text-[0.7rem] uppercase tracking-widest text-foreground/50">{label}</span>
      <span className="text-foreground/90">{value}</span>
    </div>
  );
}
