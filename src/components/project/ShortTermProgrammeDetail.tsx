import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquarePlus,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  acceptShortTermProgramme,
  addShortTermAnnotation,
  getShortTermProgramme,
  saveShortTermProgrammeTasks,
  sendShortTermProgrammeForApproval,
  setShortTermTaskStatus,
} from "@/lib/short-term-programme.functions";
import {
  isoDay,
  shiftDay,
  STP_STATUS_LABEL,
  STP_TASK_STATUS_LABEL,
  type StpStatus,
  type StpTask,
  type StpTaskStatus,
} from "@/lib/short-term-programme";
import { TaskDateBar } from "@/components/project/TaskDateBar";

const STATUS_TONE: Record<StpTaskStatus, string> = {
  not_started: "border-white/20 text-foreground/60",
  in_progress: "border-emerald-400 bg-emerald-400/15 text-emerald-300",
  at_risk: "border-amber-400 bg-amber-400/15 text-amber-300",
  done: "border-sky-400 bg-sky-400/15 text-sky-300",
};

export function ShortTermProgrammeDetail({
  programmeId,
  onBack,
}: {
  programmeId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getShortTermProgramme);
  const saveFn = useServerFn(saveShortTermProgrammeTasks);
  const sendFn = useServerFn(sendShortTermProgrammeForApproval);
  const acceptFn = useServerFn(acceptShortTermProgramme);
  const statusFn = useServerFn(setShortTermTaskStatus);
  const noteFn = useServerFn(addShortTermAnnotation);

  const q = useQuery({
    queryKey: ["short-term-programme", programmeId],
    queryFn: () => getFn({ data: { programmeId } }),
  });

  const [draft, setDraft] = useState<StpTask[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setDraft(q.data.tasks);
  }, [q.data]);

  if (q.isLoading || !q.data || !draft) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-foreground/60">
        <Loader2 size={14} className="animate-spin" /> Loading programme…
      </div>
    );
  }

  const { programme, annotations, myRole, pmSeat, variance } = q.data;
  const status = programme.status as StpStatus;
  const locked = status === "accepted";
  const canEdit = !locked && myRole !== null;
  const alreadySigned =
    myRole === "site_manager"
      ? !!programme.siteManagerAcceptedAt
      : !!programme.subcontractorAcceptedAt;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["short-term-programme", programmeId] });
    qc.invalidateQueries({ queryKey: ["short-term-programmes"] });
  };

  const saveTasks = async (next: StpTask[]) => {
    setBusy(true);
    try {
      await saveFn({
        data: {
          programmeId,
          tasks: next.map((t) => ({
            taskName: t.taskName,
            startDate: t.startDate,
            endDate: t.endDate,
            predecessors: t.predecessors,
          })),
        },
      });
      toast.success("Draft saved.");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save the draft.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      await saveFn({
        data: {
          programmeId,
          tasks: draft.map((t) => ({
            taskName: t.taskName,
            startDate: t.startDate,
            endDate: t.endDate,
            predecessors: t.predecessors,
          })),
        },
      });
      await sendFn({ data: { programmeId } });
      toast.success("Sent for approval — both parties now need to accept.");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send for approval.");
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    try {
      const res = await acceptFn({ data: { programmeId } });
      toast.success(
        res.state === "accepted"
          ? "Accepted by both parties — the programme is now locked and filed in the Project Bible."
          : res.state === "awaiting_subcontractor"
            ? "Your acceptance is recorded. Waiting on the subcontractor's PM."
            : "Your acceptance is recorded. Waiting on the site manager.",
      );
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not accept the programme.");
    } finally {
      setBusy(false);
    }
  };

  const setTaskStatus = async (taskId: string, s: StpTaskStatus) => {
    try {
      await statusFn({ data: { taskId, status: s } });
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update the task.");
    }
  };

  const addNote = async () => {
    if (note.trim().length === 0) return;
    setBusy(true);
    try {
      await noteFn({ data: { programmeId, taskId: noteTaskId, note: note.trim() } });
      setNote("");
      setNoteTaskId(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not add the note.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft size={12} /> All short-term programmes
      </button>

      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
              {programme.companyName} · {programme.packageLabel}
            </p>
            <h2 className="mt-1 text-lg font-extrabold uppercase tracking-tight text-foreground">
              {programme.title}
            </h2>
            <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
              {STP_STATUS_LABEL[status]} · built via{" "}
              {programme.createdVia === "upload" ? "upload" : "AI builder"}
            </p>
          </div>
          {locked && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-sky-400 bg-sky-400/15 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-sky-300">
              <Lock size={11} /> Locked
            </span>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["Site manager", programme.siteManagerAcceptedBy, programme.siteManagerAcceptedAt],
            [
              "Subcontractor PM",
              programme.subcontractorAcceptedBy,
              programme.subcontractorAcceptedAt,
            ],
          ].map(([label, who, when]) => (
            <div
              key={label as string}
              className={`rounded-md border p-2.5 ${
                when ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/15"
              }`}
            >
              <p className="font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                {label}
              </p>
              <p className="mt-0.5 text-xs text-foreground">
                {when ? `Accepted by ${who} · ${new Date(when as string).toLocaleString()}` : "Not yet accepted"}
              </p>
            </div>
          ))}
        </div>

        {!pmSeat && (
          <p className="mt-3 rounded-md border border-amber-400/50 bg-amber-400/10 p-2.5 text-xs text-amber-200">
            {programme.companyName} has no project manager seat accepted on this project yet, so
            nobody can counter-sign. Invite their PM on an admin seat from the Trade Directory first.
          </p>
        )}

        {status !== "accepted" && myRole && (
          <div className="mt-3 flex flex-wrap gap-2">
            {status === "draft" && (
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || draft.length === 0}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Send for approval
              </button>
            )}
            {status === "pending_acceptance" && (
              <button
                type="button"
                onClick={() => void accept()}
                disabled={busy || alreadySigned}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {alreadySigned ? "You have accepted" : "Accept programme"}
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => void saveTasks(draft)}
                disabled={busy}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Save draft
              </button>
            )}
          </div>
        )}
      </div>

      {variance && (
        <div className="glass-panel p-4">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
            Position against this programme
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <Stat label="Planned" value={`${variance.plannedPct}%`} />
            <Stat label="Verified" value={`${variance.actualPct}%`} />
            <Stat
              label="Variance"
              value={
                variance.daysVariance === 0
                  ? "On programme"
                  : `${Math.abs(variance.daysVariance)}d ${variance.daysVariance > 0 ? "behind" : "ahead"}`
              }
            />
            <Stat label="Status" value={String(variance.status).replace("_", " ")} />
          </div>
          <p className="mt-2 text-xs text-foreground/80">{variance.note}</p>
        </div>
      )}

      <div className="glass-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
            Tasks ({draft.length})
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() =>
                setDraft([
                  ...draft,
                  {
                    seq: draft.length,
                    localRef: String(draft.length + 1),
                    taskName: "",
                    startDate: draft.at(-1)?.endDate
                      ? shiftDay(draft.at(-1)!.endDate, 1)
                      : isoDay(new Date()),
                    endDate: draft.at(-1)?.endDate
                      ? shiftDay(draft.at(-1)!.endDate, 3)
                      : shiftDay(isoDay(new Date()), 2),
                    predecessors: [],
                    status: "not_started",
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 px-2.5 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40"
            >
              <Plus size={11} /> Add task
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {draft.map((t, i) => (
            <div key={t.id ?? i} className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 font-mono text-[0.6rem] text-foreground/40">{t.localRef}</span>
                {canEdit ? (
                  <input
                    value={t.taskName}
                    onChange={(e) =>
                      setDraft(draft.map((x, j) => (j === i ? { ...x, taskName: e.target.value } : x)))
                    }
                    placeholder="Task name"
                    className="flex-1 rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm text-foreground outline-none focus:border-alert"
                  />
                ) : (
                  <p className="flex-1 py-1.5 text-sm font-semibold text-foreground">{t.taskName}</p>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                    className="rounded-sm border border-white/15 p-2 text-foreground/50 hover:border-red-400 hover:text-red-400"
                    aria-label="Remove task"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {canEdit ? (
                <div className="mt-2">
                  <TaskDateBar
                    value={t}
                    anchor={draft[0]?.startDate}
                    onChange={(next) =>
                      setDraft(draft.map((x, j) => (j === i ? { ...x, ...next } : x)))
                    }
                  />
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {t.startDate} → {t.endDate}
                  </span>
                  {(["not_started", "in_progress", "at_risk", "done"] as StpTaskStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!myRole || !t.id}
                      onClick={() => t.id && void setTaskStatus(t.id, s)}
                      className={`rounded-sm border px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest transition disabled:opacity-40 ${
                        t.status === s ? STATUS_TONE[s] : "border-white/15 text-foreground/50"
                      }`}
                    >
                      {STP_TASK_STATUS_LABEL[s]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNoteTaskId(t.id ?? null)}
                    className="ml-auto inline-flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-alert hover:underline"
                  >
                    <MessageSquarePlus size={11} /> Note
                  </button>
                </div>
              )}
            </div>
          ))}
          {draft.length === 0 && (
            <p className="py-6 text-center text-xs text-foreground/50">No tasks yet.</p>
          )}
        </div>
      </div>

      <div className="glass-panel p-4">
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
          Annotations {noteTaskId ? "· against selected task" : "· whole programme"}
        </p>
        {myRole && (
          <div className="mt-2 flex flex-wrap gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Comment on progress, delays, access, sequencing…"
              className="min-w-[14rem] flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => void addNote()}
                disabled={busy || note.trim().length === 0}
                className="btn-primary px-4 py-2 text-xs disabled:opacity-40"
              >
                Post
              </button>
              {noteTaskId && (
                <button
                  type="button"
                  onClick={() => setNoteTaskId(null)}
                  className="text-[0.55rem] uppercase tracking-widest text-foreground/50 hover:text-foreground"
                >
                  Clear task
                </button>
              )}
            </div>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {annotations.map((a) => (
            <div key={a.id} className="rounded-md border border-white/10 bg-black/25 p-2.5">
              <p className="font-mono text-[0.55rem] uppercase tracking-widest text-foreground/45">
                {a.authorName} · {new Date(a.createdAt).toLocaleString()}
                {a.taskId ? " · task note" : ""}
              </p>
              <p className="mt-1 text-xs text-foreground/85">{a.note}</p>
            </div>
          ))}
          {annotations.length === 0 && (
            <p className="py-3 text-center text-xs text-foreground/50">No annotations yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.55rem] uppercase tracking-widest text-foreground/45">{label}</p>
      <p className="text-base font-extrabold text-foreground">{value}</p>
    </div>
  );
}
