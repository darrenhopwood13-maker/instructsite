import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { listQsQueue, setDiaryQsStatus } from "@/lib/daily-diary.functions";

export function QsVerificationQueue({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listQsQueue);
  const setStatusFn = useServerFn(setDiaryQsStatus);

  const q = useQuery({
    queryKey: ["qs-queue", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const decide = async (diaryId: string, status: "approved" | "rejected") => {
    try {
      await setStatusFn({ data: { diaryId, status } });
      toast.success(status === "approved" ? "Approved — pushed to IFC." : "Rejected.");
      qc.invalidateQueries({ queryKey: ["qs-queue", projectId] });
      qc.invalidateQueries({ queryKey: ["zone-completion", projectId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update diary.");
    }
  };

  const pending = (q.data ?? []).filter((r: any) => r.qs_status === "pending");
  const decided = (q.data ?? []).filter((r: any) => r.qs_status !== "pending").slice(0, 8);

  return (
    <div>
      <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
        QS Verification Queue
      </h2>
      <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
        Unverified valuation claims from today's checkouts
      </p>
      <ul className="mt-3 space-y-2">
        {pending.map((r: any) => (
          <li key={r.id} className="glass-panel border-l-4 border-l-alert p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {r.trade_package ?? "Untagged"} · {r.operative_count} ops · {r.hours_logged}h
                </p>
                <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {r.work_zones?.name ?? "no zone"}
                  {r.work_zones?.level ? ` · ${r.work_zones.level}` : ""} · Status:{" "}
                  <span className="text-alert">{r.progress_status}</span> · Completion{" "}
                  <span className="text-alert">{r.completion_pct}%</span>
                </p>
                {r.notes && (
                  <p className="mt-2 rounded-sm border border-white/10 bg-black/30 p-2 text-xs italic text-foreground/70">
                    "{r.notes}"
                  </p>
                )}
                {r.photo_urls?.length > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    <ImageIcon size={10} /> {r.photo_urls.length} photo
                    {r.photo_urls.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => decide(r.id, "approved")}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-green-500 bg-green-500/10 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-widest text-green-400 hover:bg-green-500/20"
                >
                  <CheckCircle2 size={12} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.id, "rejected")}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1.5 text-[0.6rem] uppercase tracking-widest text-foreground/60 hover:border-red-500 hover:text-red-400"
                >
                  <XCircle size={12} /> Reject
                </button>
              </div>
            </div>
          </li>
        ))}
        {pending.length === 0 && (
          <li className="glass-panel p-4 text-center text-xs text-foreground/50">
            No pending diaries.
          </li>
        )}
      </ul>

      {decided.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[0.6rem] uppercase tracking-widest text-foreground/50 hover:text-foreground">
            Recently decided ({decided.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {decided.map((r: any) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-sm border border-white/10 bg-black/20 px-2 py-1.5 text-[0.65rem] text-foreground/70"
              >
                <span className="truncate">
                  {r.trade_package ?? "Untagged"} · {r.completion_pct}%
                </span>
                <span
                  className={`font-mono uppercase tracking-widest ${
                    r.qs_status === "approved" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {r.qs_status}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
