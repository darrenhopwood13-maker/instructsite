import { useState, type ReactNode } from "react";
import { Lock, ArrowUpRight } from "lucide-react";
import { useProjectAccess, FEATURE_LABEL, type FeatureKey } from "@/lib/access";
import { BespokeUpgradeModal } from "@/components/subscriptions/BespokeUpgradeModal";
import { useNavigate } from "@tanstack/react-router";

/**
 * Wrap any feature that requires a specific subscription tier.
 * - Baseline (or upstream) tier → renders children.
 * - Structure locked → shows an "Upgrade" placeholder linking to /billing.
 * - Apex locked → shows a "Request Bespoke" placeholder that opens the modal.
 */
export function FeatureGate({
  projectId,
  feature,
  children,
  fallbackLabel,
}: {
  projectId: string;
  feature: FeatureKey;
  children: ReactNode;
  fallbackLabel?: string;
}) {
  const access = useProjectAccess(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  if (access.loading) {
    return <div className="h-8 w-32 animate-pulse rounded bg-[#1E293B]/30" aria-busy />;
  }
  if (access.check(feature)) return <>{children}</>;

  const label = fallbackLabel ?? FEATURE_LABEL[feature];
  const isApex = access.isApexFeature(feature);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isApex) setModalOpen(true);
          else navigate({ to: "/billing/$projectId", params: { projectId } });
        }}
        className="group inline-flex items-center gap-2 rounded-md border-2 border-dashed border-[#FB923C]/60 bg-[#0A192F] px-4 py-3 text-left text-white transition hover:border-[#FB923C] hover:bg-[#1E293B]"
      >
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FB923C]/15 text-[#FB923C]">
          <Lock size={14} />
        </span>
        <span className="flex-1">
          <span className="block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-[#FB923C]">
            {isApex ? "Apex · Bespoke" : "Structure · Upgrade"}
          </span>
          <span className="block text-sm font-bold">{label}</span>
        </span>
        <ArrowUpRight
          size={16}
          className="text-white/40 transition group-hover:text-[#FB923C]"
        />
      </button>
      <BespokeUpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        feature={feature}
      />
    </>
  );
}
