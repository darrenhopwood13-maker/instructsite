import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, FolderOpen, MapPin, ShieldAlert } from "lucide-react";
import { listMyProjects, getMyRoles, listMyOrgsForProjectCreation } from "@/lib/projects.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — instructSite" },
      { name: "description", content: "Manage active construction projects and onboarding." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);
  const listFn = useServerFn(listMyProjects);
  const rolesFn = useServerFn(getMyRoles);
  const orgsFn = useServerFn(listMyOrgsForProjectCreation);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(),
    enabled: ready,
  });
  const roles = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
  });
  const creatableOrgs = useQuery({
    queryKey: ["creatable-orgs"],
    queryFn: () => orgsFn(),
    enabled: ready,
  });

  const isMaster = roles.data?.roles.includes("master_admin");
  const canCreate = isMaster || (creatableOrgs.data?.length ?? 0) > 0;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              Portfolio
            </p>
            <h1
              className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Active Projects
            </h1>
          </div>
          {canCreate && (
            <Link
              to="/projects/new"
              className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider"
            >
              <Plus size={16} /> New Project
            </Link>
          )}
        </div>

        {ready && roles.data && (
          <div className="mt-4">
            {isMaster ? (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-alert bg-alert/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-alert shadow-[0_0_20px_-6px_hsl(var(--alert))]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-alert" />
                Signed in as Master Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-foreground/70">
                Signed in as {roles.data.roles.join(", ") || "member"}
              </span>
            )}
          </div>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {projects.data?.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="glass-panel group block p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-alert" />
                    <h2 className="text-lg font-extrabold uppercase tracking-tight text-foreground">
                      {p.name}
                    </h2>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/60">
                    <MapPin size={12} /> {p.site_address}
                  </p>
                </div>
                <ShieldAlert size={14} className="text-foreground/40" />
              </div>
              {p.scope_brief && (
                <p className="mt-3 line-clamp-2 text-sm text-foreground/70">{p.scope_brief}</p>
              )}
            </Link>
          ))}
          {projects.data && projects.data.length === 0 && (
            <div className="glass-panel col-span-full p-8 text-center text-sm text-foreground/60">
              No projects yet. {canCreate ? "Click 'New Project' to begin onboarding." : "Ask your Organisation Admin to onboard a project."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
