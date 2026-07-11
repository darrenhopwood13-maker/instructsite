import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Users, Copy, Check, Loader2, Trash2, ShieldCheck } from "lucide-react";
import {
  getMyOrg,
  listOrgMembers,
  listClaimableOrgs,
  claimOrgAdmin,
  removeOrgMember,
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
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn(), enabled: ready });
  const members = useQuery({
    queryKey: ["org-members"],
    queryFn: () => membersFn(),
    enabled: ready && !!org.data,
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
    if (!org.data) return;
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

  // No org yet — show claim screen
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
          {org.data.org.name}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-foreground/50">
          You are {org.data.role}
        </p>

        {isAdmin && (
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
