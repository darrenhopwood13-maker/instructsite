import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Users,
  Copy,
  Check,
  Loader2,
  Trash2,
  ShieldCheck,
  Plus,
  Building2,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import {
  getMyOrg,
  listOrgMembers,
  listClaimableOrgs,
  claimOrgAdmin,
  removeOrgMember,
  listAllOrgs,
} from "@/lib/orgs.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/org")({
  head: () => ({ meta: [{ title: "Organisation — instructSite" }] }),
  component: OrgPage,
});

function OrgPage() {
  const qc = useQueryClient();
  const orgFn = useServerFn(getMyOrg);
  const membersFn = useServerFn(listOrgMembers);
  const claimableFn = useServerFn(listClaimableOrgs);
  const claimFn = useServerFn(claimOrgAdmin);
  const removeFn = useServerFn(removeOrgMember);
  const allOrgsFn = useServerFn(listAllOrgs);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn(), enabled: ready });
  const isOwner = org.data?.role === "owner";

  const allOrgs = useQuery({
    queryKey: ["all-orgs"],
    queryFn: () => allOrgsFn(),
    enabled: ready && isOwner,
  });
  const members = useQuery({
    queryKey: ["org-members"],
    queryFn: () => membersFn(),
    enabled: ready && !!org.data && !isOwner,
  });
  const claimable = useQuery({
    queryKey: ["claimable-orgs"],
    queryFn: () => claimableFn(),
    enabled: ready && org.isFetched && !org.data,
  });

  async function claim(orgId: string) {
    setClaiming(orgId);
    setError(null);
    try {
      await claimFn({ data: { orgId } });
      qc.invalidateQueries();
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.message || "Claim failed.");
    } finally {
      setClaiming(null);
    }
  }

  async function copyLink() {
    if (!org.data || !org.data.org) return;
    const url = `${window.location.origin}/join-org/${org.data.org.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this member?")) return;
    await removeFn({ data: { memberId: id } });
    qc.invalidateQueries({ queryKey: ["org-members"] });
  }

  if (!ready || org.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============================================================
  // FOUNDER VIEW — all organisations grid + create button
  // ============================================================
  if (isOwner) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
        <div className="aurora-bg" />
        <div className="grain-overlay" />
        <div className="relative mx-auto max-w-6xl px-6 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
                Founder Console
              </p>
              <h1
                className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
                style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
              >
                Organisations
              </h1>
              <p className="mt-2 text-sm text-foreground/60">
                Every organisation on instructSite. Each one is fully isolated — its own projects, members and data.
              </p>
            </div>
            <Link
              to="/org/new"
              className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider"
            >
              <Plus size={16} /> New Organisation
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {allOrgs.isLoading && (
              <div className="col-span-full text-center text-sm text-foreground/60">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            )}
            {allOrgs.data?.map((o) => (
              <Link
                key={o.id}
                to="/org/$orgId"
                params={{ orgId: o.id }}
                className="glass-panel group block p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-alert" />
                      <h2 className="text-lg font-extrabold uppercase tracking-tight text-foreground">
                        {o.name}
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-foreground/50">{o.slug}</p>
                  </div>
                  <ChevronRight size={16} className="text-foreground/40 group-hover:text-alert" />
                </div>
                <div className="mt-4 flex items-center gap-5 text-xs text-foreground/70">
                  <span className="inline-flex items-center gap-1.5">
                    <FolderOpen size={12} className="text-alert" /> {o.project_count} project{o.project_count === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={12} /> {o.member_count} member{o.member_count === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            ))}
            {allOrgs.data && allOrgs.data.length === 0 && (
              <div className="glass-panel col-span-full p-8 text-center text-sm text-foreground/60">
                No organisations yet. Click <strong>New Organisation</strong> to create the first one.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // NON-FOUNDER: unchanged claim / member views
  // ============================================================
  if (!org.data) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
        <div className="aurora-bg" />
        <div className="relative mx-auto max-w-3xl px-6 py-14">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">Onboarding</p>
          <h1
            className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', sans-serif" }}
          >
            Claim your organisation
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Pick a test organisation to run as its master admin. Each org holds one admin + up to two subcontractors.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-3">
            {claimable.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {(claimable.data ?? []).length === 0 && !claimable.isLoading && (
              <p className="text-sm text-muted-foreground">
                All test orgs have admins. Ask an admin for a subcontractor invite link.
              </p>
            )}
            {(claimable.data ?? []).map((o) => (
              <div
                key={o.id}
                className="glass-btn flex items-center justify-between rounded-xl border border-white/10 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{o.name}</p>
                  <p className="text-xs text-foreground/50">{o.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => claim(o.id)}
                  disabled={claiming === o.id}
                  className="glass-orange inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  {claiming === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Claim as admin
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = org.data.role === "admin";

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">Organisation</p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground"
          style={{ fontFamily: "'Zen Dots', sans-serif" }}
        >
          {org.data.org?.name}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-foreground/50">
          You are {org.data.role}
        </p>

        {isAdmin && org.data.org && (
          <div className="glass-btn mt-8 rounded-2xl border border-white/10 p-5">
            <p className="text-xs uppercase tracking-widest text-foreground/60">Invite subcontractor</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this link with a subcontractor. Max 2 subcontractor seats per org.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-foreground/80">
                {typeof window !== "undefined" ? `${window.location.origin}/join-org/${org.data.org.slug}` : ""}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="glass-orange inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs uppercase tracking-widest"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <section className="mt-8">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
            <Users className="h-4 w-4" /> Members
          </p>
          <div className="mt-3 space-y-2">
            {(members.data?.members ?? []).map((m) => (
              <div key={m.id} className="glass-btn flex items-center justify-between rounded-xl border border-white/10 p-3">
                <div>
                  <p className="text-sm text-foreground">{m.user_id.slice(0, 8)}…</p>
                  <p className="text-[0.65rem] uppercase tracking-widest text-foreground/50">{m.role}</p>
                </div>
                {isAdmin && m.role !== "admin" && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="rounded-lg border border-white/10 p-2 text-foreground/60 hover:border-red-400/50 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8">
          <Link to="/snags" className="glass-btn inline-flex rounded-lg px-4 py-2 text-xs uppercase tracking-widest">
            → Go to Snag Master
          </Link>
        </div>
      </div>
    </div>
  );
}
