import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { acceptSubcontractorInvite } from "@/lib/subcontractors.functions";
import { getGateStatus } from "@/lib/gate.functions";

export const Route = createFileRoute("/invite/$token")({
  // Invite-scope password gate temporarily disabled alongside the site gate.
  head: () => ({
    meta: [{ title: "Join Project — Subcontractor Access" }],
  }),
  component: InviteAccept,
});



function InviteAccept() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptSubcontractorInvite);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureOracleSession();
        const res = await acceptFn({ data: { token } });
        if (cancelled) return;
        setProjectName("Redirecting to your cockpit…");
        navigate({ to: "/subcontractor/$projectId", params: { projectId: res.projectId } });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Invite could not be redeemed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, acceptFn, navigate]);

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative w-full max-w-md rounded-2xl border-2 border-alert bg-black/85 p-8 text-center shadow-[0_0_60px_rgba(255,80,0,0.35)]">
        {error ? (
          <>
            <AlertTriangle className="mx-auto text-alert" size={36} />
            <h1
              className="mt-3 text-2xl font-black uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Invite Rejected
            </h1>
            <p className="mt-3 text-sm text-foreground/70">{error}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-white/50"
            >
              Back to Home
            </button>
          </>
        ) : (
          <>
            <ShieldCheck className="mx-auto text-alert" size={36} />
            <h1
              className="mt-3 text-2xl font-black uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Subcontractor Access
            </h1>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-foreground/70">
              <Loader2 className="animate-spin" size={16} />
              {projectName ?? "Validating your invite…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
