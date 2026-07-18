import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, CreditCard } from "lucide-react";
import { PricingTiers } from "@/components/subscriptions/PricingTiers";
import { BespokeUpgradeModal } from "@/components/subscriptions/BespokeUpgradeModal";
import {
  createCheckoutSession,
  getProjectSubscription,
} from "@/lib/subscriptions.functions";
import type { Tier } from "@/lib/access";

export const Route = createFileRoute("/billing/$projectId")({
  head: () => ({
    meta: [
      { title: "Billing · InstructSite" },
      { name: "description", content: "Manage your InstructSite subscription tier and billing." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { projectId } = Route.useParams();
  const subFn = useServerFn(getProjectSubscription);
  const coFn = useServerFn(createCheckoutSession);
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [bespokeOpen, setBespokeOpen] = useState(false);

  const sub = useQuery({
    queryKey: ["project-subscription", projectId],
    queryFn: () => subFn({ data: { projectId } }),
  });

  const currentTier = (sub.data?.tier as Tier | undefined) ?? "baseline";
  const status = sub.data?.status ?? "trialing";

  const handleSelect = async (tier: Tier) => {
    if (tier === "apex") {
      setBespokeOpen(true);
      return;
    }
    if (tier === currentTier) return;
    setLoadingTier(tier);
    try {
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/billing/${projectId}`
          : `/billing/${projectId}`;
      const res = await coFn({ data: { projectId, tier, returnUrl } });
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      if (res?.stripeConfigured === false) {
        toast.info("Billing is not configured yet. You are on the Baseline plan.");
        setLoadingTier(null);
        return;
      }
      throw new Error("Stripe session did not return a URL.");
    } catch (err) {
      toast.error((err as Error).message);
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A192F] text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.32em] text-white/50 hover:text-[#FB923C]"
        >
          <ArrowLeft size={12} /> Back to project
        </Link>

        <header className="mt-6 border-b border-[#1E293B] pb-6">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.4em] text-[#FB923C]">
            Billing · Subscription
          </p>
          <h1
            className="mt-2 text-4xl font-black tracking-tight"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Current Plan
          </h1>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatusCard label="Tier" value={currentTier.toUpperCase()} accent />
          <StatusCard label="Status" value={status.replace(/_/g, " ").toUpperCase()} />
          <StatusCard
            label="Renews"
            value={
              sub.data?.current_period_end
                ? new Date(sub.data.current_period_end).toLocaleDateString("en-GB")
                : "—"
            }
          />
        </div>

        <section className="mt-12">
          <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.36em] text-white/50">
            Change plan
          </h2>
          <div className="mt-4">
            <PricingTiers
              currentTier={currentTier}
              onSelect={handleSelect}
              loadingTier={loadingTier}
            />
          </div>
        </section>

        <p className="mt-10 flex items-center gap-2 text-xs text-white/50">
          <CreditCard size={12} /> Secured by Stripe · Invoices sent via email
          <ExternalLink size={11} />
        </p>
      </div>

      <BespokeUpgradeModal
        open={bespokeOpen}
        onClose={() => setBespokeOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}

function StatusCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-2 p-5 ${
        accent
          ? "border-[#FB923C] bg-[#FB923C]/10"
          : "border-[#1E293B] bg-[#1E293B]/40"
      }`}
    >
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.32em] text-white/50">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-black tracking-tight ${
          accent ? "text-[#FB923C]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
