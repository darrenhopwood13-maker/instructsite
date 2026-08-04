import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EyeOff, Loader2, Lock, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createPrivateProgramme,
  deletePrivateProgramme,
  getPrivateProgramme,
  listPrivateProgrammes,
  savePrivateProgramme,
} from "@/lib/private-programme.functions";
import { TaskDateBar } from "@/components/project/TaskDateBar";
import { isoDay, STP_TASK_STATUS_LABEL, type StpTaskStatus } from "@/lib/short-term-programme";
import { TRADE_PACKAGES } from "@/lib/trade-packages";

type Draft = {
  taskName: string;
  startDate: string;
  endDate: string;
  packageLabel: string | null;
  status: StpTaskStatus;
};

const STATUS_TONE: Record<StpTaskStatus, string> = {
  not_started: "border-white/20 text-foreground/60",
  in_progress: "border-emerald-400 bg-emerald-400/15 text-emerald-300",
  at_risk: "border-amber-400 bg-amber-400/15 text-amber-300",
  done: "border-sky-400 bg-sky-400/15 text-sky-300",
};

/**
 * Private, personal short-term programme editor.
 *
 * No counterpart, no acceptance, no lock — the owner types tasks in and can
 * change them whenever. Visibility is enforced by owner-only RLS, not here.
 */
function PrivateProgrammeEditor({
  programmeId,
  onBack,
  onChanged,
}: {
  programmeId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const getFn = useServerFn(getPrivateProgramme);
  const saveFn = useServerFn(savePrivateProgramme);

  const q = useQuery({
    queryKey: ["private-programme", programmeId],
    queryFn: () => getFn({ data: { programmeId } }),
  });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [packages, setPackages] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setTitle(q.data.programme.title);
    setNotes(q.data.programme.notes ?? "");
    setPackages(q.data.programme.packages);
    setTasks(
      q.data.tasks.map((t) => ({
        taskName: t.taskName,
        startDate: t.startDate,
        endDate: t.endDate,
        packageLabel: t.packageLabel,
        status: t.status,
      })),
    );
  }, [q.data]);

  const patch = (i: number, next: Partial<Draft>) =>
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...next } : t)));

  const addTask = () => {
    const last = tasks[tasks.length - 1];
    const day = last ? last.endDate : isoDay(new Date());
    setTasks((prev) => [
      ...prev,
      { taskName: "", startDate: day, endDate: day, packageLabel: null, status: "not_started" },
    ]);
  };

  const save = async () => {
    setBusy(true);
    try {
      const clean = tasks.filter((t) => t.taskName.trim().length > 0);
      const res = await saveFn({
        data: {
          programmeId,
          title: title.trim() || "Private programme",
          packages,
          notes: notes.trim() || null,
          tasks: clean,
        },
      });
      toast.success(`Saved · ${res.taskCount} tasks.`);
      onChanged();
      void q.refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-foreground/60">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60 hover:text-foreground"
      >
        ← All private programmes
      </button>

      <div className="glass-panel space-y-3 p-4">
        <p className="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
          <EyeOff size={11} /> Private · visible only to you
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-sm font-bold text-foreground outline-none focus:border-alert"
        />
        <div className="flex flex-wrap gap-1.5">
          {TRADE_PACKAGES.map((p) => {
            const on = packages.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() =>
                  setPackages((prev) => (on ? prev.filter((x) => x !== p) : [...prev, p]))
                }
                className={`rounded-sm border px-2 py-1 text-[0.6rem] uppercase tracking-widest ${
                  on ? "border-alert bg-alert/20 text-alert" : "border-white/15 text-foreground/55"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Personal notes (optional)"
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-xs text-foreground outline-none focus:border-alert"
        />
      </div>

      <div className="space-y-3">
        {tasks.map((t, i) => (
          <div key={i} className="glass-panel space-y-2 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 font-mono text-[0.6rem] text-foreground/40">{i + 1}</span>
              <input
                value={t.taskName}
                onChange={(e) => patch(i, { taskName: e.target.value })}
                placeholder="Task name"
                className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert"
              />
              <button
                type="button"
                onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded-sm border border-white/15 p-2 text-foreground/50 hover:text-red-400"
                aria-label={`Remove task ${i + 1}`}
              >
                <Trash2 size={12} />
              </button>
            </div>

            <TaskDateBar
              value={{ startDate: t.startDate, endDate: t.endDate }}
              anchor={tasks[0]?.startDate}
              onChange={(next) => patch(i, next)}
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={t.packageLabel ?? ""}
                onChange={(e) => patch(i, { packageLabel: e.target.value || null })}
                className="rounded-sm border border-white/15 bg-black/40 px-2 py-1.5 text-[0.65rem] text-foreground outline-none focus:border-alert"
              >
                <option value="">Any package</option>
                {TRADE_PACKAGES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {(Object.keys(STP_TASK_STATUS_LABEL) as StpTaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch(i, { status: s })}
                  className={`rounded-sm border px-2 py-1.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                    t.status === s ? STATUS_TONE[s] : "border-white/12 text-foreground/45"
                  }`}
                >
                  {STP_TASK_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addTask}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs"
        >
          <Plus size={12} /> Add task
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
        </button>
      </div>
    </div>
  );
}

export function PrivateProgrammePanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPrivateProgrammes);
  const createFn = useServerFn(createPrivateProgramme);
  const deleteFn = useServerFn(deletePrivateProgramme);

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["private-programmes", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["private-programmes", projectId] });

  const create = async () => {
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          projectId,
          title: newTitle.trim() || "My working programme",
          packages: [],
          notes: null,
        },
      });
      setCreating(false);
      setNewTitle("");
      refresh();
      setOpenId(res.programmeId);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteFn({ data: { programmeId: id } });
      refresh();
      toast.success("Deleted.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not delete.");
    }
  };

  if (openId) {
    return (
      <PrivateProgrammeEditor
        programmeId={openId}
        onBack={() => setOpenId(null)}
        onChanged={refresh}
      />
    );
  }

  const programmes = list.data?.programmes ?? [];

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
            <EyeOff size={11} /> Private working programmes
          </p>
          <p className="mt-1 max-w-lg text-xs text-foreground/60">
            Your own manual list, for record purposes only. Nobody else — not the subcontractor, not
            other site managers — can see these. No acceptance, no lock, edit them any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs"
        >
          <Plus size={13} /> New private programme
        </button>
      </div>

      {list.isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-foreground/60">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : programmes.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <Lock size={20} className="mx-auto text-foreground/30" />
          <p className="mt-2 text-sm text-foreground/70">No private programmes yet.</p>
          <p className="mt-1 text-xs text-foreground/45">
            Jot down your own sequence across any packages — it stays with you.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {programmes.map((p) => (
            <div
              key={p.id}
              className="glass-panel flex flex-wrap items-center gap-3 p-4 transition hover:border-alert/60"
            >
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="min-w-[12rem] flex-1 text-left"
              >
                <p className="text-sm font-bold text-foreground">{p.title}</p>
                <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/45">
                  {p.taskCount} tasks ·{" "}
                  {p.packages.length > 0 ? p.packages.join(", ") : "All packages"} · updated{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <button
                type="button"
                onClick={() => void remove(p.id)}
                className="rounded-sm border border-white/15 p-2 text-foreground/50 hover:text-red-400"
                aria-label={`Delete ${p.title}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur">
          <div className="glass-panel relative my-16 w-full max-w-md p-6">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="absolute right-4 top-4 rounded-sm border border-white/15 p-1.5 text-foreground/60 hover:text-foreground"
              aria-label="Close"
            >
              <X size={14} />
            </button>
            <h3 className="text-lg font-extrabold uppercase tracking-tight text-foreground">
              New private programme
            </h3>
            <p className="mt-1 text-xs text-foreground/55">
              Manual entry only. Visible to you alone.
            </p>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="My working programme"
              className="mt-4 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-alert"
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="btn-primary mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
