import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FolderOpen, MapPin, ClipboardCheck } from "lucide-react";
import { listMyProjects } from "@/lib/projects.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/qs/")({
  head: () => ({
    meta: [
      { title: "QS Workspace — instructSite" },
      {
        name: "description",
        content: "Pick a project to verify daily site diaries as quantity surveyor.",
      },
      { property: "og:title", content: "QS Workspace — instructSite" },
      {
        property: "og:description",
        content: "Pick a project to verify daily site diaries as quantity surveyor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QsIndexPage,
});

function QsIndexPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const listFn = useServerFn(listMyProjects);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(),
    enabled: ready,
  });

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
          QS Workspace
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Verification Projects
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {projects.data?.map((p) => (
            <Link
              key={p.id}
              to="/qs/$projectId"
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
                <ClipboardCheck size={14} className="text-foreground/40" />
              </div>
              <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-alert">
                Open verification queue
              </p>
            </Link>
          ))}
          {ready && projects.data?.length === 0 && (
            <p className="text-sm text-foreground/60">
              No projects assigned to you yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
