/**
 * Three-figure progress lineage: the subcontractor's claim, the site
 * manager's inspected figure and the QS measured figure. The highest
 * priority non-null figure (QS, then manager, then claim) is badged as
 * EFFECTIVE because that is the one driving the model and the valuation.
 */

const EFFECTIVE_TITLE =
  "This is the figure driving the IFC model colouring and the valuation. QS measured wins, then the site manager's inspected figure, then the subcontractor's claim.";

function num(value: number | null | undefined): number | null {
  return value === null || value === undefined || Number.isNaN(Number(value))
    ? null
    : Number(value);
}

export function ProgressLineage({
  claimed,
  managerVerified,
  qsVerified,
  className = "",
}: {
  claimed: number | null | undefined;
  managerVerified: number | null | undefined;
  qsVerified: number | null | undefined;
  className?: string;
}) {
  const c = num(claimed);
  const m = num(managerVerified);
  const q = num(qsVerified);

  const effective: "qs" | "manager" | "claimed" | null =
    q !== null ? "qs" : m !== null ? "manager" : c !== null ? "claimed" : null;

  const cells: Array<{ key: "claimed" | "manager" | "qs"; label: string; value: number | null }> =
    [
      { key: "claimed", label: "Claimed", value: c },
      { key: "manager", label: "Manager", value: m },
      { key: "qs", label: "QS", value: q },
    ];

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {cells.map((cell) => {
        const isEffective = effective === cell.key;
        const isNull = cell.value === null;
        return (
          <div
            key={cell.key}
            title={isEffective ? EFFECTIVE_TITLE : undefined}
            className={`rounded-sm border px-2 py-1 ${
              isEffective
                ? "border-emerald-500/60 bg-emerald-500/10"
                : isNull
                  ? "border-white/10 bg-black/20 opacity-45"
                  : "border-white/15 bg-black/30"
            }`}
          >
            <p
              className={`text-[0.5rem] font-bold uppercase tracking-widest ${
                isEffective ? "text-emerald-400" : "text-foreground/50"
              }`}
            >
              {cell.label}
            </p>
            <p
              className={`font-mono text-xs font-bold leading-tight ${
                isEffective ? "text-emerald-300" : "text-foreground/80"
              }`}
            >
              {isNull ? "—" : `${cell.value}%`}
            </p>
            {isEffective && (
              <p className="text-[0.45rem] font-bold uppercase tracking-widest text-emerald-400/80">
                Effective
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
