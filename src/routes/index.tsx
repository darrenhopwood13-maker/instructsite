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
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="aurora-bg" />
      <div className="grain-overlay" />

      <div className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.5em] text-alert">
            AI · Site Operations
          </p>
          <h1
            className="mt-6 text-7xl font-extrabold leading-none tracking-tight md:text-8xl lg:text-9xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            <span style={{ color: "#ff7a00" }}>instruct</span>
            <span className="text-white">Site</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl font-medium text-white/85">
            Turn complex 2D drawings into instant, plain-English sequences.
          </p>
          <p className="mt-2 text-sm md:text-base text-white/60">
            Whether you have 30 years of experience or 30 days — get the edge in seconds.
          </p>
          <div className="mt-10 h-px w-32 mx-auto bg-alert" />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
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

        <div className="mt-20 grid grid-cols-2 gap-3 md:grid-cols-4">
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
        </div>
      </div>
    </div>
  );
}

