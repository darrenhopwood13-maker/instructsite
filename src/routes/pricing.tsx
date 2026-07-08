import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PricingTiers } from "@/components/subscriptions/PricingTiers";
import { BespokeUpgradeModal } from "@/components/subscriptions/BespokeUpgradeModal";
import type { Tier } from "@/lib/access";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · InstructSite — Baseline · Structure · Apex" },
      {
        name: "description",
        content:
          "Three tiers for construction operations at Tier-1 scale. Baseline £299/mo, Structure £599/mo, and Apex bespoke enterprise deployments.",
      },
      { property: "og:title", content: "InstructSite Pricing" },
      {
        property: "og:description",
        content:
          "Baseline £299/mo essential command surface, Structure £599/mo adds BIM + Randall, Apex bespoke ERP/SSO/Green-Mesh.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [bespokeOpen, setBespokeOpen] = useState(false);

  const handleSelect = (tier: Tier) => {
    if (tier === "apex") {
      setBespokeOpen(true);
      return;
    }
    // Baseline / Structure require a project context — send them into the app.
    // Marketing route just prompts sign-in.
    window.location.href = "/auth?redirect=/projects";
  };

  return (
    <div className="min-h-screen bg-[#0A192F] text-white">
      {/* Blueprint grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(203,213,225,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(203,213,225,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.32em] text-white/50 hover:text-[#FB923C]"
        >
          <ArrowLeft size={12} /> Back home
        </Link>

        <header className="mt-6 border-b border-[#1E293B] pb-8">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.4em] text-[#FB923C]">
            Subscription Hierarchy
          </p>
          <h1
            className="mt-3 text-5xl font-black tracking-tight md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Priced per project.
            <br />
            <span className="text-[#FB923C]">Scaled per programme.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
            Every InstructSite subscription is scoped to a single active project. Pay
            monthly, scale seats and tools as the programme grows, and step up to Apex
            when governance and ERP integration take over.
          </p>
        </header>

        <div className="mt-10">
          <PricingTiers currentTier={null} onSelect={handleSelect} />
        </div>

        <div className="mt-16 grid gap-4 rounded-lg border border-[#1E293B] bg-[#1E293B]/40 p-6 md:grid-cols-3">
          <StatBlock label="Managers · Baseline cap" value="Unlimited" />
          <StatBlock label="Subcontractor seats" value="3 per company" hint="1 admin · 2 read-only per project" />
          <StatBlock label="Uptime" value="99.9%" hint="Apex tier SLA" />
        </div>

        <p className="mt-10 max-w-2xl text-xs uppercase tracking-[0.22em] text-white/40">
          All prices exclude VAT. Cancel any time — programme data exports remain
          available for 90 days post-cancellation.
        </p>
      </div>

      <BespokeUpgradeModal
        open={bespokeOpen}
        onClose={() => setBespokeOpen(false)}
        projectId="00000000-0000-0000-0000-000000000000"
      />
    </div>
  );
}

function StatBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.32em] text-white/50">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-black tracking-tight text-white">{value}</p>
      {hint && <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-[#FB923C]">{hint}</p>}
    </div>
  );
}
