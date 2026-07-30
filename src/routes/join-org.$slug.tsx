import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { joinOrgAsSub } from "@/lib/orgs.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/join-org/$slug")({
  head: () => ({ meta: [{ title: "Join Organisation — instructSite" }] }),
  component: JoinOrgPage,
});

function JoinOrgPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const joinFn = useServerFn(joinOrgAsSub);
  const [state, setState] = useState<"loading" | "joining" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureOracleSession().then(async () => {
      setState("joining");
      try {
        await joinFn({ data: { slug } });
        setState("done");
        setTimeout(() => navigate({ to: "/snags" }), 1200);
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setError((e as any)?.message || "Could not join.");
        setState("error");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      {state === "joining" || state === "loading" ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-alert" />
          <p className="mt-4 text-sm uppercase tracking-widest text-foreground/70">Joining organisation…</p>
        </>
      ) : state === "done" ? (
        <>
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-4 text-lg font-semibold text-foreground">You're in.</p>
          <p className="mt-1 text-xs text-muted-foreground">Redirecting to Snag Master…</p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="glass-btn mt-6 inline-flex rounded-lg px-4 py-2 text-xs uppercase tracking-widest"
          >
            Home
          </button>
        </>
      )}
    </div>
  );
}
