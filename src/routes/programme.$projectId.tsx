import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  UploadCloud,
  StickyNote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import {
  compileProgrammePlaybooks,
  getPlaybookForDate,
  getPlaybookRange,
  listManagerNotes,
  addManagerNote,
} from "@/lib/programme.functions";

export const Route = createFileRoute("/programme/$projectId")({
  head: () => ({
    meta: [{ title: "Randall — Programme Reference Diary" }],
  }),
  component: ProgrammePage,
});

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtHuman(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

function ProgrammePage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const projectFn = useServerFn(getProject);
  const rolesFn = useServerFn(getMyRoles);
  const compileFn = useServerFn(compileProgrammePlaybooks);
  const dayFn = useServerFn(getPlaybookForDate);
  const rangeFn = useServerFn(getPlaybookRange);
  const notesFn = useServerFn(listManagerNotes);
  const addNoteFn = useServerFn(addManagerNote);

  const qc = useQueryClient();

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectFn({ data: { projectId } }),
    enabled: ready,
  });
  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const isAdmin =
    rolesQ.data?.roles?.includes("master_admin") ||
    rolesQ.data?.roles?.includes("project_admin");

  const rangeQ = useQuery({
    queryKey: ["playbook-range", projectId],
    queryFn: () => rangeFn({ data: { projectId } }),
    enabled: ready,
  });

  const [date, setDate] = useState<string>(toIso(new Date()));

  // Snap initial view to project first date if today is outside range
  useEffect(() => {
    const r = rangeQ.data;
    if (!r?.firstDate || !r.lastDate) return;
    if (date < r.firstDate || date > r.lastDate) setDate(r.firstDate);
  }, [rangeQ.data, date]);

  const playbookQ = useQuery({
    queryKey: ["playbook", projectId, date],
    queryFn: () => dayFn({ data: { projectId, date } }),
    enabled: ready,
  });

  const notesQ = useQuery({
    queryKey: ["manager-notes", projectId, date],
    queryFn: () => notesFn({ data: { projectId, date } }),
    enabled: ready,
  });

  // Realtime: manager notes for this date, globally synced
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`manager-notes:${projectId}:${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "programme_manager_notes",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row =
            (payload.new as { note_date?: string } | null) ??
            (payload.old as { note_date?: string } | null);
          if (row?.note_date === date) {
            qc.invalidateQueries({ queryKey: ["manager-notes", projectId, date] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready, projectId, date, qc]);

  const compileMut = useMutation({
    mutationFn: async (file: File) => {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      return compileFn({
        data: {
          projectId,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          dataBase64: b64,
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["playbook-range", projectId] });
      qc.invalidateQueries({ queryKey: ["playbook", projectId] });
      if (res.firstDate) setDate(res.firstDate);
    },
  });

  const noteMut = useMutation({
    mutationFn: async (body: string) => addNoteFn({ data: { projectId, date, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-notes", projectId, date] });
      setDraft("");
    },
  });

  const [draft, setDraft] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const range = rangeQ.data;
  const canPrev = range?.firstDate ? date > range.firstDate : true;
  const canNext = range?.lastDate ? date < range.lastDate : true;

  const summary = playbookQ.data?.ai_daily_summary ?? "";

  const notes = useMemo(() => notesQ.data ?? [], [notesQ.data]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> Back to Project
        </Link>

        <div className="mt-4">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            Randall · AI Programme Compiler
          </p>
          <h1
            className="mt-1 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Programme Reference Diary
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            {project.data?.name ?? "…"} · Day-to-a-page playbook pre-compiled by
            Randall from your uploaded programme.
          </p>
        </div>

        {/* Upload compiler */}
        {isAdmin && (
          <section className="glass-panel mt-8 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-alert">
                  One-Shot Compiler
                </p>
                <h2 className="mt-1 text-lg font-extrabold uppercase tracking-tight text-foreground">
                  Upload Project Programme
                </h2>
                <p className="mt-1 text-xs text-foreground/60">
                  PDF or CSV Gantt / task list. Randall reads it once and writes
                  a plain-English playbook for every active date.
                </p>
              </div>
              <button
                type="button"
                disabled={compileMut.isPending}
                onClick={() => fileInput.current?.click()}
                className="glass-orange inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {compileMut.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Compiling…
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} /> Upload Programme
                  </>
                )}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,text/csv,.csv,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) compileMut.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>

            {compileMut.isError && (
              <p className="mt-3 text-xs text-destructive">
                {(compileMut.error as Error).message}
              </p>
            )}
            {compileMut.isSuccess && (
              <p className="mt-3 text-xs text-emerald-400">
                Compiled {compileMut.data.taskCount} task
                {compileMut.data.taskCount === 1 ? "" : "s"} across{" "}
                {compileMut.data.dayCount} active dates.
              </p>
            )}
          </section>
        )}

        {/* Date navigator */}
        <section className="glass-panel mt-8 p-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setDate(shiftDate(date, -1))}
              className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous Day
            </button>
            <div className="text-center">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">
                Today's Playbook
              </p>
              <div className="mt-1 flex items-center justify-center gap-2 text-foreground">
                <CalendarDays size={16} />
                <span
                  className="text-base font-extrabold uppercase tracking-tight md:text-lg"
                  style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
                >
                  {fmtHuman(date)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDate(toIso(new Date()))}
                className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50 hover:text-foreground"
              >
                Jump to today
              </button>
            </div>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setDate(shiftDate(date, 1))}
              className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Next Day <ChevronRight size={14} />
            </button>
          </div>
        </section>

        {/* AI Summary — read only */}
        <section className="glass-panel mt-6 p-6">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">
            AI Daily Summary · Read Only
          </p>
          <div className="mt-3">
            {playbookQ.isLoading ? (
              <p className="text-xs text-foreground/50">Loading…</p>
            ) : summary ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                {summary}
              </pre>
            ) : (
              <p className="text-sm text-foreground/60">
                No playbook entry for this date.{" "}
                {range?.firstDate
                  ? `Programme runs ${fmtHuman(range.firstDate)} → ${range.lastDate ? fmtHuman(range.lastDate) : ""}.`
                  : "Upload a programme to generate the playbook."}
              </p>
            )}
          </div>
        </section>

        {/* Manager Notes — realtime */}
        <section className="glass-panel mt-6 p-6">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-alert" />
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">
              Site Manager Global Notes · Live Synced
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {notes.length === 0 && (
              <p className="text-xs text-foreground/50">
                No notes for {fmtHuman(date)} yet.
              </p>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-md border border-white/10 bg-black/30 p-3"
              >
                <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  <span>{n.author_name ?? "Site Manager"}</span>
                  <span>
                    {new Date(n.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                  {n.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Log delays, coordination issues, weather calls, or crew swaps…"
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-alert"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={!draft.trim() || noteMut.isPending}
                onClick={() => noteMut.mutate(draft.trim())}
                className="glass-orange inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-40"
              >
                {noteMut.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Posting…
                  </>
                ) : (
                  "Post Note"
                )}
              </button>
            </div>
            {noteMut.isError && (
              <p className="mt-1 text-xs text-destructive">
                {(noteMut.error as Error).message}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
