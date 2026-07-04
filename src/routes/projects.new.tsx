import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, MapPin, FileText, AlertCircle, Loader2 } from "lucide-react";
import { createProject, getMyRoles } from "@/lib/projects.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [{ title: "New Project — Site Operations Oracle" }],
  }),
  component: NewProject,
});

function humanizeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  if (!raw) return "Something went wrong. Please try again.";
  if (/unauthor/i.test(raw)) return "Your session expired. Refresh the page and sign in again.";
  if (/master admin/i.test(raw)) return "You need Master Admin access to create a project.";
  if (/row-level security|permission denied|rls/i.test(raw))
    return "Database blocked the write. Your account is missing the required permissions.";
  if (/network|fetch|failed to fetch/i.test(raw))
    return "Couldn't reach the backend. Check your connection and retry.";
  return raw;
}

function NewProject() {
  const nav = useNavigate();
  const create = useServerFn(createProject);
  const rolesFn = useServerFn(getMyRoles);

  const [ready, setReady] = useState(false);
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [scopeBrief, setScopeBrief] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await ensureOracleSession();
        const r = await rolesFn();
        setIsMaster(r.roles.includes("master_admin"));
      } catch (e) {
        setErr(humanizeError(e));
        setIsMaster(false);
      } finally {
        setReady(true);
      }
    })();
  }, [rolesFn]);

  const canSubmit = name.trim().length > 0 && siteAddress.trim().length > 0 && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      const { id } = await create({
        data: {
          name: name.trim(),
          siteAddress: siteAddress.trim(),
          scopeBrief: scopeBrief.trim(),
        },
      });
      nav({ to: "/projects/$projectId", params: { projectId: id } });
    } catch (e) {
      setErr(humanizeError(e));
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-alert"
        >
          <ArrowLeft size={12} /> Back to Projects
        </Link>
        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
          Onboarding
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          New Project
        </h1>
        <p className="mt-2 max-w-xl text-sm text-foreground/60">
          Create the project record. After it exists, you'll upload GA Drawings, the Site
          Logistics Plan, and Master RAMS from the project dashboard.
        </p>

        {ready && isMaster === false && (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-alert/50 bg-alert/10 p-4 text-sm text-foreground">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-alert" />
            <div>
              <p className="font-bold uppercase tracking-widest text-alert">Access denied</p>
              <p className="mt-1 text-foreground/80">
                Only Master Admins can onboard new projects. Ask your Master Admin to promote
                your account.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="glass-panel mt-8 space-y-6 p-6">
          <Field label="Project Name" icon={<Building2 size={14} />} required>
            <input
              autoFocus
              disabled={!isMaster}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="e.g. Riverside Tower Phase 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Full Site Address" icon={<MapPin size={14} />} required>
            <textarea
              rows={2}
              disabled={!isMaster}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="Street, city, postcode"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
          </Field>

          <Field label="Project Brief / Scope of Works" icon={<FileText size={14} />}>
            <textarea
              rows={5}
              disabled={!isMaster}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="Scope, contract value, key trades, high-risk activities, key dates…"
              value={scopeBrief}
              onChange={(e) => setScopeBrief(e.target.value)}
            />
          </Field>

          <div className="rounded-md border border-white/10 bg-black/30 p-4 text-xs text-foreground/60">
            <p className="font-bold uppercase tracking-widest text-foreground/80">
              Next step (after create)
            </p>
            <p className="mt-1">
              You'll be taken to the project dashboard to upload GA / Drawings, Site Logistics
              plans, and Master RAMS. Each upload is parsed by the AI extraction engine.
            </p>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-alert/50 bg-alert/10 p-3 text-sm text-foreground">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-alert" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              to="/projects"
              className="glass-btn rounded-xl px-4 py-2.5 text-sm uppercase tracking-wider"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || !isMaster}
              className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Creating…
                </>
              ) : (
                "Create Project"
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
