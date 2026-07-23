import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { acceptOrgInvite, getInviteByToken } from "@/lib/orgs.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/join-org/invite/$token")({
  head: () => ({ meta: [{ title: "Accept Invite — instructSite" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getInviteByToken);
  const acceptFn = useServerFn(acceptOrgInvite);
  const [state, setState] = useState<"loading" | "ready" | "joining" | "done" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [inv, setInv] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureOracleSession();
        const data = await getFn({ data: { token } });
        setInv(data);
        setState("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    })();
  }, [getFn, token]);

  async function accept() {
    setState("joining");
    try {
      const result = await acceptFn({ data: { token } });
      setState("done");
      // Org Admins & PMs land on project creation on first login; subs go to their pack.
      const role = result?.role ?? inv?.role;
      const dest =
        role === "admin" || role === "pm" ? "/projects/new" : "/projects";
      setTimeout(() => navigate({ to: dest }), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      {state === "loading" || state === "joining" ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-alert" />
          <p className="mt-4 text-sm uppercase tracking-widest text-foreground/70">
            {state === "joining" ? "Joining…" : "Loading invite…"}
          </p>
        </>
      ) : state === "done" ? (
        <>
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-4 text-lg font-semibold text-foreground">You're in.</p>
        </>
      ) : state === "error" ? (
        <>
          <AlertCircle className="mx-auto h-10 w-10 text-alert" />
          <p className="mt-4 text-sm text-alert">{error}</p>
        </>
      ) : (
        <>
          <p className="text-[0.7rem] uppercase tracking-[0.35em] text-alert">Invitation</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">
            Join {inv?.orgs?.name}
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            You've been invited as{" "}
            <span className="font-bold uppercase text-alert">
              {inv?.role === "admin" ? "Organisation Admin" : inv?.role === "pm" ? "Project Manager" : "Subcontractor"}
            </span>
            .
          </p>
          <button
            type="button"
            onClick={accept}
            className="glass-orange shimmer-btn mt-6 inline-flex rounded-xl px-6 py-3 text-sm uppercase tracking-wider"
          >
            Accept Invite
          </button>
        </>
      )}
    </div>
  );
}
