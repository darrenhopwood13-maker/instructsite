import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProgrammePackages } from "@/lib/programme-packages.functions";

/**
 * Shared source of truth for "what packages exist on this project" so every
 * place that tags work (DABS pins, diaries, subcontractor invites) picks from
 * the same real programme baseline instead of freehand / hardcoded lists.
 */
export function useProgrammePackages(projectId: string | undefined) {
  const listFn = useServerFn(listProgrammePackages);
  const q = useQuery({
    queryKey: ["programme-packages", projectId],
    queryFn: () => listFn({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    packages: q.data?.packages ?? [],
    hasBaseline: !!q.data?.hasBaseline,
    isLoading: q.isLoading,
  };
}


/**
 * Trade package input for pin drops / briefings.
 *
 * When the project has a programme baseline imported, this is a picker of the
 * real programme packages (same grouping the variance panel uses) so entries
 * are tagged correctly at source. With no baseline — or when the work genuinely
 * isn't on the programme — it degrades to the original freehand text field.
 */
export function TradePackageField({
  projectId,
  value,
  onChange,
  label = "Trade Package",
}: {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { packages, hasBaseline, isLoading } = useProgrammePackages(projectId);
  const q = { isLoading };

  const matchesPackage = useMemo(
    () => packages.some((p) => p.label.toLowerCase() === value.trim().toLowerCase()),
    [packages, value],
  );
  const [freehand, setFreehand] = useState(false);
  const useFreehand = !hasBaseline || freehand || (!!value && !matchesPackage);

  const inputClass =
    "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert";

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
        {label}
        {hasBaseline && (
          <button
            type="button"
            onClick={() => {
              setFreehand(!useFreehand);
              onChange("");
            }}
            className="text-[0.55rem] font-bold uppercase tracking-widest text-alert hover:underline"
          >
            {useFreehand ? "Pick from programme" : "Not on programme"}
          </button>
        )}
      </span>

      {useFreehand ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Electrical First Fix"
          className={inputClass}
        />
      ) : (
        <select
          value={matchesPackage ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— Select programme package —</option>
          {packages.map((p) => (
            <option key={p.key} value={p.label}>
              {p.label} · {p.taskCount} task{p.taskCount === 1 ? "" : "s"} · {p.start} → {p.end}
            </option>
          ))}
        </select>
      )}

      <span className="mt-1 block text-[0.55rem] uppercase tracking-widest text-foreground/40">
        {q.isLoading
          ? "Checking programme baseline…"
          : hasBaseline
            ? useFreehand
              ? "Free text — will need matching in the variance panel later."
              : "Tagged against the imported programme baseline."
            : "No programme baseline imported yet — free text."}
      </span>
    </label>
  );
}

/**
 * Multi-select variant used where an invite covers one or more packages.
 * Same rule as the single field: real programme packages once a baseline
 * exists, otherwise the generic hardcoded trade list as a fallback.
 */
export function TradePackageChips({
  projectId,
  value,
  onChange,
  fallbackOptions,
}: {
  projectId: string;
  value: string[];
  onChange: (v: string[]) => void;
  fallbackOptions: readonly string[];
}) {
  const { packages, hasBaseline, isLoading } = useProgrammePackages(projectId);
  const [showFallback, setShowFallback] = useState(false);

  const useFallback = !hasBaseline || showFallback;
  const options = useFallback ? [...fallbackOptions] : packages.map((p) => p.label);
  // Keep anything already selected visible even if it isn't in the active list.
  const all = [...new Set([...options, ...value])];

  const toggle = (p: string) =>
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
          Trade Packages
        </span>
        {hasBaseline && (
          <button
            type="button"
            onClick={() => setShowFallback(!useFallback)}
            className="text-[0.55rem] font-bold uppercase tracking-widest text-alert hover:underline"
          >
            {useFallback ? "Pick from programme" : "Not on programme"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {all.map((p) => {
          const on = value.includes(p);
          return (
            <button
              type="button"
              key={p}
              onClick={() => toggle(p)}
              className={`rounded-sm border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest transition ${
                on
                  ? "border-alert bg-alert/20 text-alert"
                  : "border-white/15 text-foreground/60 hover:border-white/40"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
      <span className="mt-1 block text-[0.55rem] uppercase tracking-widest text-foreground/40">
        {isLoading
          ? "Checking programme baseline…"
          : hasBaseline
            ? useFallback
              ? "Generic trade list — will need matching in the variance panel later."
              : "Tagged against the imported programme baseline."
            : "No programme baseline imported yet — generic trade list."}
      </span>
    </div>
  );
}
