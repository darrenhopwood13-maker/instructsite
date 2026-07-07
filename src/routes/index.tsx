import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldAlert, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "instructSite" },
      {
        name: "description",
        content:
          "Premium AI command surface for construction site operations — DABS, live IFC, QS-verified progress.",
      },
      { property: "og:title", content: "instructSite" },
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
            className="mt-6 text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold leading-[0.9] tracking-tight"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            <span className="block sm:inline" style={{ color: "#ff7a00" }}>instruct</span>
            <span className="block sm:inline text-white">Site</span>
          </h1>
          <p
            className="mt-6 text-xl md:text-3xl font-black tracking-tight text-white"
            style={{ fontFamily: "'Space Grotesk', 'Inter Tight', sans-serif" }}
          >
            Turn complex 2D drawings into{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#ff7a00 0%,#ffb057 50%,#ff7a00 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 3s linear infinite",
              }}
            >
              instant, plain-English
            </span>{" "}
            sequences.
          </p>
          <p className="mt-2 text-sm md:text-base text-white/60">
            Whether you have 30 years of experience or 30 days — get the edge in seconds.
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-3xl mx-auto">
            {[
              { n: "Oracle", d: "Project Bible extraction" },
              { n: "DABS AI", d: "Daily briefing compiler" },
              { n: "Randall", d: "Programme → diary playbook" },
              { n: "BIM Auto-Allocator", d: "10k+ IFC elements in seconds" },
              { n: "QS Verifier", d: "Photo-evidence progress" },
              { n: "Permit Sentinel", d: "High-risk auto-flagging" },
            ].map((t) => (
              <div
                key={t.n}
                className="glass-panel border border-white/10 rounded-lg px-3 py-2 text-left flex items-start gap-2"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-alert shrink-0" />
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-bold uppercase tracking-wider text-alert truncate">
                    {t.n}
                  </p>
                  <p className="text-[0.7rem] text-white/70 leading-tight">{t.d}</p>
                </div>
              </div>
            ))}
          </div>

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
                  search={{ trial: "start" }}
                  className="btn-3d-orange inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider"
                >
                  Start 7-day free trial <ArrowRight size={14} />
                </Link>
                <Link
                  to="/auth"
                  className="glass-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider"
                >
                  <ShieldAlert size={14} /> Sign in
                </Link>
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <Link
              to="/experience"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-alert hover:text-white transition-colors"
            >
              ▶ Watch the cinematic experience
            </Link>
            <a
              href="/instructsite-brochure.pdf"
              download
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-white/70 hover:text-alert transition-colors"
            >
              <FileDown size={13} /> Download sales brochure (PDF)
            </a>
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

