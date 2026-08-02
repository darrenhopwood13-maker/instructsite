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

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-12">
        <div className="mx-auto max-w-4xl text-center">
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
            className="mt-8 text-2xl md:text-4xl font-black leading-tight tracking-tight text-white"
            style={{ fontFamily: "'Space Grotesk', 'Inter Tight', sans-serif" }}
          >
            Upload the drawings. Get a{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,#ff7a00 0%,#ffb057 50%,#ff7a00 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 3s linear infinite",
              }}
            >
              site that runs itself
            </span>
            .
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-white/70">
            AI reads every sheet and pulls out drawing numbers and zones on its own.
            Crews drop live DABS pins that write the site diary for you, the BIM model
            turns green the moment a QS approves the work, and anything high-risk is
            flagged for permit before a boot hits the deck.
          </p>
          <p className="mt-6 text-sm md:text-base text-white/60">
            Whether you have 30 years of experience or 30 days — get the edge in seconds.
          </p>

          <div className="mt-10 flex justify-center">
            {signedIn ? (
              <button
                onClick={() => navigate({ to: "/projects" })}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm uppercase tracking-wider"
              >
                Enter portal <ArrowRight size={14} />
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ trial: "start" }}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm uppercase tracking-wider"
              >
                Start 7-day free trial <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            {!signedIn && (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-white/70 transition-colors hover:text-alert"
              >
                <ShieldAlert size={13} /> Sign in
              </Link>
            )}
            <Link
              to="/experience"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-alert transition-colors hover:text-white"
            >
              ▶ Watch the cinematic experience
            </Link>
            <a
              href="/instructsite-brochure.pdf"
              download
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-white/70 transition-colors hover:text-alert"
            >
              <FileDown size={13} /> Download sales brochure (PDF)
            </a>
          </div>
        </div>

        <section className="mt-24" aria-labelledby="capabilities-heading">
          <div className="text-center">
            <div className="mx-auto h-px w-32 bg-alert" />
            <h2
              id="capabilities-heading"
              className="mt-8 text-2xl md:text-3xl font-extrabold tracking-tight text-white"
            >
              Six engines running your site
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/60">
              Each one automates a job that used to eat a manager's day.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { n: "Oracle", d: "Reads the Project Bible and answers in plain English." },
              { n: "DABS AI", d: "Live pin drops compile into the daily briefing and site diary." },
              { n: "Randall", d: "Turns the programme into a day-by-day diary playbook." },
              { n: "BIM Auto-Allocator", d: "Maps 10k+ IFC elements to zones in seconds." },
              { n: "QS Verifier", d: "Photo-evidence progress — zones flip green on approval." },
              { n: "Permit Sentinel", d: "Auto-flags high-risk work and forces digital sign-off." },
            ].map((t) => (
              <div
                key={t.n}
                className="glass-panel flex items-start gap-3 rounded-xl border border-white/10 p-6 text-left"
              >
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-alert" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-alert">
                    {t.n}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>


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

