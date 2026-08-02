import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, MapPin, ShieldAlert } from "lucide-react";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import { QsVerificationQueue } from "@/components/project/QsVerificationQueue";
import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { countOutstandingPermits } from "@/lib/permits.functions";

export const Route = createFileRoute("/qs/$projectId")({
  head: () => ({
    meta: [
      { title: "QS — Verification" },
      {
        name: "description",
        content: "Quantity surveyor verification queue for daily site diaries.",
      },
      { property: "og:title", content: "QS — Verification" },
      {
        property: "og:description",
        content: "Quantity surveyor verification queue for daily site diaries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QsProjectPage,
});

function QsProjectPage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const rolesFn = useServerFn(getMyRoles);
  const getP = useServerFn(getProject);

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const roles = rolesQ.data?.roles ?? [];
  const allowed =
    roles.includes("qs") ||
    roles.includes("master_admin") ||
    roles.includes("project_admin") ||
    roles.includes("site_manager");
  const gateReady = ready && !rolesQ.isLoading;
  const allowLoad = gateReady && allowed;

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: allowLoad,
    staleTime: 60_000,
  });

  if (gateReady && !allowed) {
    return <AccessDeniedScreen message="Access denied — QS verification is restricted." />;
  }
  if (project.isError) {
    return <AccessDeniedScreen message={(project.error as Error)?.message} />;
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/qs"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> All QS Projects
        </Link>

        <div className="mt-4">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            QS — Verification
          </p>
          <h1
            className="mt-1 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            {project.data?.name ?? "…"}
          </h1>
          {project.data?.site_address && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-foreground/70">
              <MapPin size={14} /> {project.data.site_address}
            </p>
          )}
        </div>

        {allowLoad && <PermitAlertStrip projectId={projectId} />}

        {allowLoad && (
          <div className="mt-8">
            <QsVerificationQueue projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}

function PermitAlertStrip({ projectId }: { projectId: string }) {
  const countFn = useServerFn(countOutstandingPermits);
  const q = useQuery({
    queryKey: ["permits-outstanding", projectId],
    queryFn: () => countFn({ data: { projectId } }),
    refetchInterval: 30_000,
  });
  const n = q.data?.outstanding ?? 0;
  const expired = q.data?.expired ?? 0;
  if (n === 0 && expired === 0) return null;
  return (
    <div className="mt-6 space-y-2">
      {expired > 0 && (
        <Link
          to="/permits/$projectId"
          params={{ projectId }}
          className="flex items-center gap-2 rounded-md border-2 border-alert bg-alert/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-alert hover:bg-alert/20"
        >
          <Clock size={14} /> {expired} expired {expired === 1 ? "permit" : "permits"} — not
          renewed or revoked · view register
        </Link>
      )}
      {n > 0 && (
        <Link
          to="/permits/$projectId"
          params={{ projectId }}
          className="flex items-center gap-2 rounded-md border-2 border-amber-400 bg-amber-400/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-400/20"
        >
          <ShieldAlert size={14} /> {n} high-risk {n === 1 ? "activity is" : "activities are"}{" "}
          awaiting a permit to work — view register
        </Link>
      )}
    </div>
  );
}

