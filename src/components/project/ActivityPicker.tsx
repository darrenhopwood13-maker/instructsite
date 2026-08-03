import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Search, Share2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listActivityOptions,
  promoteActivityType,
  saveProjectActivity,
} from "@/lib/activity-library.functions";

/**
 * Two-tier activity description picker.
 *
 * The project's own saved entries come first (most relevant to the work in
 * hand), the org-wide generic library sits below, and "Add custom" is always
 * available at the bottom so the control is never a dead end.
 *
 * Anything typed saves to the *project* list immediately. Promotion to the
 * shared org library is a separate, skippable, one-tap prompt that only ever
 * appears for wording that already passed the project-specificity guard.
 */
export function ActivityPicker({
  projectId,
  selected,
  onChange,
}: {
  projectId: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const listFn = useServerFn(listActivityOptions);
  const saveFn = useServerFn(saveProjectActivity);
  const promoteFn = useServerFn(promoteActivityType);

  const [query, setQuery] = useState("");
  const [promptFor, setPromptFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const opts = useQuery({
    queryKey: ["activity-options", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    staleTime: 60_000,
  });

  const q = query.trim().toLowerCase();
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

  const add = (label: string) => {
    if (!selected.some((s) => s.toLowerCase() === label.toLowerCase())) {
      onChange([...selected, label]);
    }
    setQuery("");
  };

  const addCustom = async () => {
    const label = query.trim();
    if (label.length < 2) return;
    add(label);
    setSaving(true);
    try {
      const res = await saveFn({ data: { projectId, label } });
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

  return (
    <div>
      <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
        Scope of Work · Activities
      </span>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-sm border border-alert/60 bg-alert/10 px-2 py-1 text-[0.65rem] text-foreground"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== s))}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addCustom();
            }
          }}
          placeholder="Search or describe an activity…"
          className="w-full rounded-md border border-white/15 bg-black/40 py-2.5 pl-9 pr-3 font-mono text-sm text-foreground outline-none focus:border-alert"
        />
      </div>

      {query.trim().length > 0 && (
        <div className="mt-1.5 overflow-hidden rounded-md border border-white/15 bg-black/70">
          {projectOpts.length > 0 && (
            <>
              <p className="border-b border-white/10 bg-white/5 px-3 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
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
          <button
            type="button"
            onClick={() => void addCustom()}
            disabled={saving}
            className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-alert hover:bg-alert/10"
          >
            <Plus size={12} /> Add "{query.trim()}"
          </button>
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
