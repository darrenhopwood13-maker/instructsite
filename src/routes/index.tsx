import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Site Operations Oracle" },
      {
        name: "description",
        content:
          "Premium AI command surface for construction site operations — DABS, live IFC, QS-verified progress.",
      },
      { property: "og:title", content: "Site Operations Oracle" },
      {
        property: "og:description",
        content: "Premium AI tooling for site operations.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data?.user?.id));
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-12 gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
        <div className="col-span-12 lg:col-span-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.5em] text-alert">
            AI · Site Operations
          </p>
          <h1
            className="mt-6 text-4xl font-extrabold leading-[0.95] tracking-tight text-foreground sm:text-5xl md:text-7xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            The command
            <br />
            surface for
            <br />
            site operations.
          </h1>
          <div className="mt-8 h-px w-32 bg-alert" />
          <p className="mt-8 max-w-xl text-base leading-relaxed text-foreground/75">
            Upload the drawing pack. Watch zones light up as trades complete work.
            DABS as single source of truth. QS-verified progress. Live IFC model. Every
            action audited, every role scoped.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {signedIn ? (
              <button
                onClick={() => navigate({ to: "/projects" })}
                className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider"
              >
                Enter portal <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider"
                >
                  <ShieldAlert size={14} /> Sign in
                </Link>
                <Link
                  to="/auth"
                  search={{ redirect: undefined }}
                  className="glass-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider"
                >
                  Request access
                </Link>
              </>
            )}
          </div>
        </div>

        <aside className="col-span-12 space-y-3 lg:col-span-4">
          {[
            { k: "DABS", d: "Daily briefings as the single source of truth." },
            { k: "IFC", d: "Live 3D model — zones flip green on QS approval." },
            { k: "QS", d: "Verified progress with photo evidence." },
            { k: "Permits", d: "High-risk auto-flagging + digital sign-off." },
          ].map((f) => (
            <div key={f.k} className="glass-panel border border-white/10 p-5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">
                {f.k}
              </p>
              <p className="mt-2 text-sm text-foreground/80">{f.d}</p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
