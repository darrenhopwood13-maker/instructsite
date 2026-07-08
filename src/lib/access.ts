/**
 * Client-side subscription tier + feature gating.
 * Mirrors the has_feature() SQL function — the DB is source of truth,
 * this hook powers UI states.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProjectSubscription } from "@/lib/subscriptions.functions";

export type Tier = "baseline" | "structure" | "apex";

export type FeatureKey =
  | "dabs"
  | "diary"
  | "oracle_ai"
  | "bim_viewport"
  | "randall_auto"
  | "erp_bridge"
  | "sso"
  | "green_mesh"
  | "dedicated_tam";

export const FEATURE_TIER: Record<FeatureKey, Tier> = {
  dabs: "baseline",
  diary: "baseline",
  oracle_ai: "baseline",
  bim_viewport: "structure",
  randall_auto: "structure",
  erp_bridge: "apex",
  sso: "apex",
  green_mesh: "apex",
  dedicated_tam: "apex",
};

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  dabs: "DABS Command",
  diary: "Daily Site Diary",
  oracle_ai: "Oracle AI",
  bim_viewport: "BIM Viewport",
  randall_auto: "Randall Auto-Pilot",
  erp_bridge: "Full ERP / COINS Bridge",
  sso: "Enterprise SSO",
  green_mesh: "Green-Mesh Verification",
  dedicated_tam: "Dedicated TAM",
};

const RANK: Record<Tier, number> = { baseline: 0, structure: 1, apex: 2 };

export function checkAccess(currentTier: Tier | null, feature: FeatureKey): boolean {
  const need = FEATURE_TIER[feature];
  const have = currentTier ?? "baseline";
  return RANK[have] >= RANK[need];
}

export function useProjectSubscription(projectId: string | undefined) {
  const fn = useServerFn(getProjectSubscription);
  return useQuery({
    queryKey: ["project-subscription", projectId],
    enabled: !!projectId,
    queryFn: () => fn({ data: { projectId: projectId! } }),
    staleTime: 60_000,
  });
}

export function useProjectAccess(projectId: string | undefined) {
  const q = useProjectSubscription(projectId);
  const tier = (q.data?.tier as Tier | undefined) ?? null;
  return {
    tier,
    status: q.data?.status ?? null,
    loading: q.isLoading,
    check: (feature: FeatureKey) => checkAccess(tier, feature),
    isApexFeature: (feature: FeatureKey) => FEATURE_TIER[feature] === "apex",
    refetch: q.refetch,
  };
}
