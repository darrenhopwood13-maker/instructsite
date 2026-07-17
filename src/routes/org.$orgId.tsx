import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  FolderOpen,
  Users,
  MapPin,
  Loader2,
  Mail,
  Phone,
  Hash,
  StickyNote,
} from "lucide-react";
import {
  getMyOrg,
  getOrgById,
  listOrgProjects,
  listOrgMembersFor,
} from "@/lib/orgs.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/org/$orgId")({
  head: () => ({ meta: [{ title: "Organisation — instructSite" }] }),
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const orgFn = useServerFn(getMyOrg);
  const getOrgFn = useServerFn(getOrgById);
  const projectsFn = useServerFn(listOrgProjects);
  const membersFn = useServerFn(listOrgMembersFor);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const me = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn(), enabled: ready });
  const isOwner = me.data?.role === "owner";

  const org = useQuery({
    queryKey: ["owner-org", orgId],
    queryFn: () => getOrgFn({ data: { orgId } }),
    enabled: ready && isOwner,
  });
  const projects = useQuery({
    queryKey: ["owner-org-projects", orgId],
    queryFn: () => projectsFn({ data: { orgId } }),
    enabled: ready && isOwner,
  });
  const members = useQuery({
    queryKey: ["owner-org-members", orgId],
    queryFn: () => membersFn({ data: { orgId } }),
    enabled: ready && isOwner,
  });

  if (!ready || me.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm text-foreground/70">You don't have access to this page.</p>
        <Link to="/org" className="mt-4 inline-block text-alert underline">
          Back to your organisation
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-5xl px-6 py-14">
        <Link
          to="/org"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-alert"
        >
          <ArrowLeft size={12} /> All Organisations
        </Link>

        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
          Organisation
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          {org.data?.name ?? "…"}
        </h1>
        {org.data?.slug && (
          <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">{org.data.slug}</p>
        )}

        {/* Company details */}
        {org.data && (
          <section className="glass-panel mt-8 grid gap-4 p-5 md:grid-cols-2">
            <Detail icon={<Hash size={12} />} label="Company Number" value={org.data.company_number} />
            <Detail icon={<Building2 size={12} />} label="Primary Contact" value={org.data.contact_name} />
            <Detail icon={<Mail size={12} />} label="Contact Email" value={org.data.contact_email} />
            <Detail icon={<Phone size={12} />} label="Contact Phone" value={org.data.contact_phone} />
            <Detail
              icon={<MapPin size={12} />}
              label="Registered Address"
              value={org.data.registered_address}
              wide
            />
            <Detail icon={<StickyNote size={12} />} label="Notes" value={org.data.notes} wide />
          </section>
        )}

        {/* Projects */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-foreground/70">
              <FolderOpen size={14} className="text-alert" /> Projects
            </h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {projects.isLoading && (
              <div className="col-span-full text-center text-sm text-foreground/60">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            )}
            {projects.data?.map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="glass-panel block p-5 transition-transform hover:-translate-y-0.5"
              >
                <h3 className="text-lg font-extrabold uppercase tracking-tight text-foreground">
                  {p.name}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/60">
                  <MapPin size={12} /> {p.site_address}
                </p>
                {p.scope_brief && (
                  <p className="mt-3 line-clamp-2 text-sm text-foreground/70">{p.scope_brief}</p>
                )}
              </Link>
            ))}
            {projects.data && projects.data.length === 0 && (
              <div className="glass-panel col-span-full p-8 text-center text-sm text-foreground/60">
                No projects yet in this organisation.
              </div>
            )}
          </div>
        </section>

        {/* Members */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-foreground/70">
            <Users size={14} /> Members
          </h2>
          <div className="mt-4 space-y-2">
            {(members.data ?? []).map((m) => (
              <div
                key={m.id}
                className="glass-btn flex items-center justify-between rounded-xl border border-white/10 p-3"
              >
                <p className="text-sm text-foreground">{m.user_id.slice(0, 8)}…</p>
                <p className="text-[0.65rem] uppercase tracking-widest text-foreground/50">{m.role}</p>
              </div>
            ))}
            {members.data && members.data.length === 0 && (
              <p className="text-sm text-foreground/60">No members yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/60">
        {icon} {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
        {value?.trim() ? value : <span className="text-foreground/40">—</span>}
      </p>
    </div>
  );
}
