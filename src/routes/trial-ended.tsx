import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/trial-ended")({
  head: () => ({
    meta: [
      { title: "Trial ended — instructSite" },
      { name: "description", content: "Your 7-day free trial has ended. Contact instructSite to continue." },
    ],
  }),
  component: TrialEnded,
});

function TrialEnded() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.5em] text-alert">Free Trial Ended</p>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}>
          Thanks for trying <span style={{ color: "#ff7a00" }}>instruct</span>Site
        </h1>
        <p className="mt-6 text-base text-foreground/80">
          Your 7-day free trial has ended. To keep your workspace and continue building your projects,
          get in touch with our team — we’ll get you set up on the right plan.
        </p>

        <div className="mt-10 inline-flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8">
          <MailCheck className="text-alert" size={36} />
          <a href="mailto:info@instructsite.com?subject=Continuing%20after%20trial%20—%20instructSite"
             className="btn-3d-orange inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm uppercase tracking-[0.3em]">
            info@instructsite.com
          </a>
          <p className="text-xs text-foreground/60">We usually reply the same working day.</p>
        </div>

        <div className="mt-10">
          <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground">
            <ArrowLeft size={12} /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
