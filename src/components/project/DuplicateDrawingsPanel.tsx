import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listDuplicateDrawings, deleteDrawingsBulk } from "@/lib/tier1-uploads.functions";
import { errorMessage } from "@/lib/error-message";

interface Props {
  projectId: string;
  onChanged?: () => void;
}

/**
 * One-off cleanup surface: lists sheets that share a drawing number + revision
 * + sheet index (or file name when no metadata parsed) and lets an admin keep
 * the original and purge the extra copies.
 */
export function DuplicateDrawingsPanel({ projectId, onChanged }: Props) {
  const listFn = useServerFn(listDuplicateDrawings);
  const deleteFn = useServerFn(deleteDrawingsBulk);
  const [busy, setBusy] = useState<string | null>(null);

  const dupes = useQuery({
    queryKey: ["duplicate-drawings", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    staleTime: 15_000,
  });

  const groups = dupes.data ?? [];
  if (dupes.isLoading || groups.length === 0) return null;

  const extras = groups.reduce((n: number, g: any) => n + g.rows.length - 1, 0);

  const purge = async (group: any) => {
    const keep = group.rows[0];
    const remove = group.rows.slice(1);
    const ok = window.confirm(
      `Keep the original ${group.label} (uploaded ${new Date(keep.created_at).toLocaleString()}) and permanently delete ${remove.length} duplicate copy/copies?`,
    );
    if (!ok) return;
    setBusy(group.key);
    try {
      await deleteFn({
        data: { projectId, drawingIds: remove.map((r: any) => r.id) },
      });
      toast.success(`${remove.length} duplicate sheet(s) removed.`);
      await dupes.refetch();
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const purgeAll = async () => {
    const ok = window.confirm(
      `Delete all ${extras} duplicate sheets across ${groups.length} group(s), keeping the earliest upload of each?`,
    );
    if (!ok) return;
    setBusy("__all__");
    try {
      const ids = groups.flatMap((g: any) => g.rows.slice(1).map((r: any) => r.id));
      await deleteFn({ data: { projectId, drawingIds: ids } });
      toast.success(`${ids.length} duplicate sheets removed.`);
      await dupes.refetch();
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass-panel border-2 border-amber-400/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-300" size={16} />
          <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-amber-300">
            Duplicate sheets detected
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dupes.refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40"
          >
            <RefreshCw size={11} /> Rescan
          </button>
          <button
            type="button"
            onClick={purgeAll}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-md border border-alert bg-alert/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-alert hover:bg-alert/30 disabled:opacity-40"
          >
            {busy === "__all__" ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Merge all ({extras})
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-foreground/60">
        {groups.length} sheet{groups.length === 1 ? "" : "s"} appear more than once. Merging keeps
        the earliest upload and deletes the extra copies.
      </p>

      <ul className="mt-3 space-y-2">
        {groups.map((g: any) => (
          <li
            key={g.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-foreground/85">{g.label}</p>
              <p className="font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                {g.rows.length} copies · {g.rows.filter((r: any) => r.in_dabs).length} in DABS
              </p>
            </div>
            <button
              type="button"
              onClick={() => purge(g)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/80 hover:border-alert hover:text-alert disabled:opacity-40"
            >
              {busy === g.key ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Keep 1 · delete {g.rows.length - 1}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
