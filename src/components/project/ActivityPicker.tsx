import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Check, Plus, Search, Share2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listActivityOptions,
  promoteActivityType,
  saveProjectActivity,
} from "@/lib/activity-library.functions";
import { listProgrammeTasks } from "@/lib/programme-packages.functions";

/**
 * Three-tier activity description picker.
 *
 * Tier 0 — the master programme. When a baseline has been imported, the real
 * tasks come first (the package in hand at the very top) so work is booked
 * against `task_ref` at source instead of being reconciled later.
 * Tier 1 — the project's own saved entries.
 * Tier 2 — the org-wide generic library, with "Add custom" always available
 * so the control is never a dead end.
 *
 * With no baseline the programme tier simply doesn't render and the control
 * behaves exactly as it did before.
 *
 * Anything typed saves to the *project* list immediately. Promotion to the
 * shared org library is a separate, skippable, one-tap prompt that only ever
 * appears for wording that already passed the project-specificity guard.
 */
export function ActivityPicker({
  projectId,
  selected,
  onChange,
  single = false,
  tradePackage = null,
  programmeTaskRef = null,
  onProgrammeTaskRefChange,
  label = "Scope of Work · Activities",
  placeholder = "Search or describe an activity…",
}: {
  projectId: string;
  selected: string[];
  onChange: (next: string[]) => void;
  /** DABS pin mode: one activity at a time. */
  single?: boolean;
  /** Trade package currently chosen, so its own tasks float to the top. */
  tradePackage?: string | null;
  programmeTaskRef?: string | null;
  onProgrammeTaskRefChange?: (ref: string | null) => void;
  label?: string;
  placeholder?: string;
}) {
  const listFn = useServerFn(listActivityOptions);
  const saveFn = useServerFn(saveProjectActivity);
  const promoteFn = useServerFn(promoteActivityType);
  const tasksFn = useServerFn(listProgrammeTasks);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [promptFor, setPromptFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const opts = useQuery({
    queryKey: ["activity-options", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    staleTime: 60_000,
  });

  const programme = useQuery({
    queryKey: ["programme-tasks", projectId],
    queryFn: () => tasksFn({ data: { projectId } }),
    staleTime: 5 * 60_000,
    enabled: !!onProgrammeTaskRefChange,
  });

  const q = query.trim().toLowerCase();
  const pkgKey = tradePackage?.trim().toLowerCase() ?? "";

  const programmeOpts = useMemo(() => {
    const all = programme.data?.tasks ?? [];
    const matching = all.filter(
      (t) =>
        !q ||
        t.taskName.toLowerCase().includes(q) ||
        (t.taskRef ?? "").toLowerCase().includes(q) ||
        t.packageLabel.toLowerCase().includes(q),
    );
    if (!pkgKey) return q ? matching.slice(0, 10) : [];
    const inPkg = matching.filter((t) => t.packageKey === pkgKey);
    // With nothing typed, only the crew's own package is offered; a search
    // may legitimately reach across the whole programme.
    const ranked = q ? [...inPkg, ...matching.filter((t) => t.packageKey !== pkgKey)] : inPkg;
    return ranked.slice(0, 10);
  }, [programme.data, q, pkgKey]);

  const showProgrammeHint =
    !!onProgrammeTaskRefChange && !pkgKey && !q && (programme.data?.tasks?.length ?? 0) > 0;


  const projectOpts = useMemo(
    () => (opts.data?.project ?? []).filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8),
    [opts.data, q],
  );
  const sharedOpts = useMemo(
    () =>
      (opts.data?.shared ?? [])
        .filter((o) => o.label.toLowerCase().includes(q))
        .filter((o) => !projectOpts.some((p) => p.label.toLowerCase() === o.label.toLowerCase()))
        .slice(0, 8),
    [opts.data, q, projectOpts],
  );

  // A cleared selection must never leave a stale programme link behind.
  useEffect(() => {
    if (single && selected.length === 0 && programmeTaskRef) onProgrammeTaskRefChange?.(null);
  }, [single, selected.length, programmeTaskRef, onProgrammeTaskRefChange]);

  const add = (labelText: string, taskRef: string | null = null) => {
    if (single) {
      onChange([labelText]);
    } else if (!selected.some((s) => s.toLowerCase() === labelText.toLowerCase())) {
      onChange([...selected, labelText]);
    }
    // Free text/library picks explicitly clear any previous programme link.
    onProgrammeTaskRefChange?.(taskRef);
    setQuery("");
    setOpen(false);
  };

  const addCustom = async () => {
    const labelText = query.trim();
    if (labelText.length < 2) return;
    add(labelText);
    setSaving(true);
    try {
      const res = await saveFn({ data: { projectId, label: labelText } });
      await opts.refetch();
      if (res.suggestion) setPromptFor(res.suggestion);
    } catch (err: any) {
      // Saving to the library must never block the programme being built.
      console.warn("[activity] save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const promote = async () => {
    if (!promptFor) return;
    try {
      await promoteFn({ data: { projectId, label: promptFor } });
      toast.success(`"${promptFor}" added to your shared activity library.`);
      opts.refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not share that activity type.");
    } finally {
      setPromptFor(null);
    }
  };

  const showPanel = q.length > 0 || (open && programmeOpts.length > 0);

  return (
    <div>
      <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
        {label}
      </span>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 text-[0.65rem] text-foreground"
            >
              {s}
              {programmeTaskRef && single && (
                <span className="rounded-sm bg-alert/20 px-1 font-mono text-[0.55rem] uppercase text-alert">
                  {programmeTaskRef}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  onChange(selected.filter((x) => x !== s));
                  if (single) onProgrammeTaskRefChange?.(null);
                }}
                className="text-foreground/50 hover:text-foreground"
                aria-label={`Remove ${s}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addCustom();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-white/15 bg-black/40 py-2.5 pl-9 pr-3 font-mono text-sm text-foreground outline-none focus:border-alert"
        />
      </div>

      {showPanel && (
        <div className="mt-1.5 overflow-hidden rounded-md border border-white/15 bg-black/70">
          {programmeOpts.length > 0 && (
            <>
              <p className="border-b border-white/10 bg-alert/10 px-3 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-alert">
                From the master programme
              </p>
              {programmeOpts.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => add(t.taskName, t.taskRef)}
                  className="block w-full px-3 py-2 text-left hover:bg-white/10"
                >
                  <span className="flex items-center gap-1.5 text-xs text-foreground">
                    <CalendarRange size={11} className="shrink-0 text-alert" />
                    <span className="break-words">{t.taskName}</span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.55rem] uppercase tracking-widest text-foreground/45">
                    {t.taskRef ? `${t.taskRef} · ` : ""}
                    {t.packageLabel} · {t.startDate} → {t.endDate}
                  </span>
                </button>
              ))}
            </>
          )}
          {projectOpts.length > 0 && (
            <>
              <p className="border-y border-white/10 bg-white/5 px-3 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                This project
              </p>
              {projectOpts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => add(o.label)}
                  className="block w-full px-3 py-2 text-left text-xs text-foreground hover:bg-white/10"
                >
                  {o.label}
                </button>
              ))}
            </>
          )}
          {sharedOpts.length > 0 && (
            <>
              <p className="border-y border-white/10 bg-white/5 px-3 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                Shared library
              </p>
              {sharedOpts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => add(o.label)}
                  className="block w-full px-3 py-2 text-left text-xs text-foreground/85 hover:bg-white/10"
                >
                  {o.label}
                </button>
              ))}
            </>
          )}
          {q.length > 0 && (
            <button
              type="button"
              onClick={() => void addCustom()}
              disabled={saving}
              className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-alert hover:bg-alert/10"
            >
              <Plus size={12} /> Add "{query.trim()}"
            </button>
          )}
        </div>
      )}

      {promptFor && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-white/15 bg-white/5 p-2.5">
          <Share2 size={13} className="text-alert" />
          <p className="flex-1 text-[0.68rem] text-foreground/80">
            Add <span className="font-semibold text-foreground">{promptFor}</span> to your
            organisation's shared activity list? Nothing project-specific is shared.
          </p>
          <button
            type="button"
            onClick={() => void promote()}
            className="inline-flex items-center gap-1 rounded-sm bg-alert px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-black"
          >
            <Check size={11} /> Share
          </button>
          <button
            type="button"
            onClick={() => setPromptFor(null)}
            className="rounded-sm border border-white/15 px-2.5 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/60"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
