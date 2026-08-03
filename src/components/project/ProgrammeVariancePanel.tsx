import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus, AlertTriangle, Link2 } from "lucide-react";
import { getProgrammeVariance, setProgrammePackageLink } from "@/lib/programme-variance.functions";
import { errorMessage } from "@/lib/error-message";

type Status = "ahead" | "on_track" | "behind" | "not_started" | "complete";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  behind: { label: "BEHIND", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
  ahead: { label: "AHEAD", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" },
  on_track: { label: "ON TRACK", cls: "border-primary/50 bg-primary/10 text-primary" },
  not_started: { label: "NOT STARTED", cls: "border-border bg-muted/30 text-muted-foreground" },
  complete: { label: "COMPLETE", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" },
};

export function ProgrammeVariancePanel({ projectId }: { projectId: string }) {
  const varianceFn = useServerFn(getProgrammeVariance);
  const linkFn = useServerFn(setProgrammePackageLink);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [showMatcher, setShowMatcher] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["programme-variance", projectId],
    queryFn: () => varianceFn({ data: { projectId } }),
    staleTime: 120_000,
  });

  const packages = useMemo(() => (q.data?.packages ?? []) as any[], [q.data]);
  const details = (q.data?.details ?? {}) as Record<string, any>;
  const sources = ((q.data as any)?.sources ?? []) as Array<{
    label: string;
    pins: number;
    diaries: number;
    linkedTo: string | null;
  }>;

  async function saveLink(sourceLabel: string, packageKey: string | null) {
    setSaving(sourceLabel);
    try {
      await linkFn({ data: { projectId, sourceLabel, packageKey } });
      await queryClient.invalidateQueries({ queryKey: ["programme-variance", projectId] });
      toast.success(packageKey ? "Package match saved" : "Match cleared — back to auto");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }


  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">PROGRAMME VS SITE</h2>
          <p className="text-xs text-muted-foreground">
            Baseline compared with DABS pin activity and QS-verified diaries only.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {q.data?.today ? (
            <span className="text-xs text-muted-foreground">as at {q.data.today}</span>
          ) : null}
          {sources.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowMatcher((v) => !v)}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <Link2 className="h-3 w-3" /> {showMatcher ? "DONE" : "FIX MATCHES"}
            </button>
          ) : null}
        </div>
      </div>

      {showMatcher && sources.length > 0 ? (
        <div className="mb-3 rounded-lg border border-border bg-background/40 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Tell Randall which programme package each site package belongs to. Anything left on
            auto is matched by wording.
          </p>
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.label} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                <span className="text-muted-foreground">
                  {s.pins} pins · {s.diaries} diaries
                </span>
                <select
                  value={s.linkedTo ?? ""}
                  disabled={saving === s.label}
                  onChange={(e) => saveLink(s.label, e.target.value || null)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="">Auto (match by wording)</option>
                  {packages.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ) : null}


      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Calculating variance…</p>
      ) : q.error ? (
        <p className="text-xs text-destructive">{errorMessage(q.error)}</p>
      ) : !q.data?.hasBaseline ? (
        <p className="text-xs text-muted-foreground">
          No programme baseline imported for this project yet.
        </p>
      ) : packages.length === 0 ? (
        <p className="text-xs text-muted-foreground">No packages found in the baseline.</p>
      ) : (
        <ul className="space-y-2">
          {packages.map((p) => {
            const meta = STATUS_META[p.status as Status] ?? STATUS_META.on_track;
            const isOpen = open === p.key;
            const d = details[p.key] ?? { pins: [], diaries: [], tasks: [] };
            return (
              <li key={p.key} className="rounded-lg border border-border bg-background/40">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : p.key)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.label}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {p.downstreamRisk ? (
                        <span className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> DOWNSTREAM RISK
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.note}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1 text-sm font-semibold">
                      {p.daysVariance > 0 ? (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      ) : p.daysVariance < 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {p.daysVariance === 0 ? "0d" : `${Math.abs(p.daysVariance)}d`}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.actualPct}% / {p.plannedPct}% planned
                    </div>
                  </div>
                </button>

                {isOpen ? (
                  <div className="space-y-3 border-t border-border px-3 py-3 text-xs">
                    <div>
                      <p className="mb-1 font-semibold text-muted-foreground">BASELINE TASKS</p>
                      <ul className="space-y-1">
                        {d.tasks.map((t: any) => (
                          <li key={t.id} className="flex flex-wrap gap-2">
                            <span className="text-foreground">{t.taskName}</span>
                            <span className="text-muted-foreground">
                              {t.startDate} → {t.endDate}
                            </span>
                            {t.predecessors?.length ? (
                              <span className="text-amber-400">after {t.predecessors.join(", ")}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="mb-1 font-semibold text-muted-foreground">
                        VERIFIED DIARIES ({d.diaries.length})
                        {p.unverifiedDiaryCount ? (
                          <span className="ml-2 font-normal text-amber-400">
                            {p.unverifiedDiaryCount} awaiting QS verification
                          </span>
                        ) : null}
                      </p>
                      {d.diaries.length === 0 ? (
                        <p className="text-muted-foreground">None — progress is unevidenced.</p>
                      ) : (
                        <ul className="space-y-1">
                          {d.diaries.map((x: any) => (
                            <li key={x.id} className="flex flex-wrap gap-2">
                              <span>{new Date(x.checkoutTime).toLocaleDateString()}</span>
                              <span className="text-muted-foreground">
                                {x.tradePackage ?? "—"} · {x.zoneName ?? "no zone"}
                              </span>
                              <span className="text-foreground">
                                {x.qsVerifiedPct ?? x.managerCompletionPct ?? x.completionPct ?? 0}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 font-semibold text-muted-foreground">
                        DABS PIN ACTIVITY ({d.pins.length})
                      </p>
                      {d.pins.length === 0 ? (
                        <p className="text-muted-foreground">No pins matched to this package.</p>
                      ) : (
                        <ul className="space-y-1">
                          {d.pins.map((x: any) => (
                            <li key={x.id} className="flex flex-wrap gap-2">
                              <span>{new Date(x.startTime).toLocaleDateString()}</span>
                              <span className="text-muted-foreground">
                                {x.tradePackage ?? "—"} · {x.zoneName ?? "no zone"} · {x.operativeCount} ops
                              </span>
                              <span className="text-muted-foreground">{x.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {p.riskFrom?.length ? (
                      <p className="text-amber-400">
                        Dependency chain: upstream {p.riskFrom.join(", ")} running late.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
