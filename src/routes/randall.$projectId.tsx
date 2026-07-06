import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UploadCloud,
  FileText,
  Trash2,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import {
  extractProgrammeWithRandall,
  listProgrammeTasksForDate,
  listManagerNotesForDate,
  upsertManagerNote,
  deleteManagerNote,
  getLatestProgrammeUpload,
} from "@/lib/randall.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

export const Route = createFileRoute("/randall/$projectId")({
  head: () => ({
    meta: [
      { title: "Randall — Programme Reference Diary" },
      {
        name: "description",
        content:
          "AI-translated construction programme, day-to-a-page. Site manager notes sync live.",
      },
    ],
  }),
  component: RandallPage,
});

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function RandallPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    ensureOracleSession().then((u) => {
      setMe(u.id);
      setReady(true);
    });
  }, []);

  const getP = useServerFn(getProject);
  const rolesFn = useServerFn(getMyRoles);
  const tasksFn = useServerFn(listProgrammeTasksForDate);
  const notesFn = useServerFn(listManagerNotesForDate);
  const upsertFn = useServerFn(upsertManagerNote);
  const deleteFn = useServerFn(deleteManagerNote);
  const extractFn = useServerFn(extractProgrammeWithRandall);
  const latestFn = useServerFn(getLatestProgrammeUpload);

  const [date, setDate] = useState(todayISO());
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });
  const roles = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const isAdmin =
    roles.data?.roles?.includes("master_admin") ||
    roles.data?.roles?.includes("project_admin");

  const latestUpload = useQuery({
    queryKey: ["randall-latest", projectId],
    queryFn: () => latestFn({ data: { projectId } }),
    enabled: ready,
  });

  const tasks = useQuery({
    queryKey: ["randall-tasks", projectId, date],
    queryFn: () => tasksFn({ data: { projectId, date } }),
    enabled: ready,
  });

  const notes = useQuery({
    queryKey: ["randall-notes", projectId, date],
    queryFn: () => notesFn({ data: { projectId, date } }),
    enabled: ready,
  });

  // Prime draft from user's own existing note for the day
  useEffect(() => {
    if (!me || !notes.data) return;
    const mine = notes.data.find((n) => n.author_id === me);
    setNoteDraft(mine?.body ?? "");
  }, [me, notes.data]);

  // Realtime sync of manager notes
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`randall-notes-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "programme_manager_notes",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["randall-notes", projectId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, ready, qc]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadMsg("Reading programme & translating with Randall…");
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await extractFn({
        data: {
          projectId,
          fileName: file.name,
          mimeType: file.type || (file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/pdf"),
          dataBase64,
        },
      });
      setUploadMsg(`Extracted ${res.taskCount} tasks.`);
      qc.invalidateQueries({ queryKey: ["randall-latest", projectId] });
      qc.invalidateQueries({ queryKey: ["randall-tasks", projectId] });
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteDraft.trim()) return;
    setSaving(true);
    try {
      await upsertFn({ data: { projectId, date, body: noteDraft.trim() } });
      qc.invalidateQueries({ queryKey: ["randall-notes", projectId, date] });
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["randall-notes", projectId, date] });
  };

  const activeTasks = useMemo(() => tasks.data ?? [], [tasks.data]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> Back to Project
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              Randall · Programme Reference Diary
            </p>
            <h1
              className="mt-1 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {project.data?.name ?? "…"}
            </h1>
            {latestUpload.data && (
              <p className="mt-2 text-xs text-foreground/60">
                Latest programme: {latestUpload.data.file_name} ·{" "}
                {latestUpload.data.task_count} tasks
              </p>
            )}
          </div>

          {isAdmin && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="glass-orange inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs uppercase tracking-wider disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UploadCloud size={14} />
                )}
                Upload Project Programme
              </button>
            </div>
          )}
        </div>

        {uploadMsg && (
          <div className="glass-panel mt-4 p-3 text-xs text-foreground/80">
            {uploadMsg}
          </div>
        )}

        {/* Date navigator */}
        <div className="glass-panel mt-6 flex items-center justify-between gap-3 p-4">
          <button
            type="button"
            onClick={() => setDate((d) => shiftISO(d, -1))}
            className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-wider"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
              <CalendarDays size={12} /> Viewing
            </div>
            <div
              className="mt-1 text-lg font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {prettyDate(date)}
            </div>
            {date !== todayISO() && (
              <button
                type="button"
                onClick={() => setDate(todayISO())}
                className="mt-1 text-[0.65rem] uppercase tracking-widest text-alert hover:underline"
              >
                Jump to today
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDate((d) => shiftISO(d, 1))}
            className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-wider"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>

        {/* Tasks */}
        <section className="mt-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            Scheduled Today · Read-Only
          </p>
          <h2
            className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            What Should Be Happening
          </h2>

          {tasks.isLoading ? (
            <div className="glass-panel mt-4 flex items-center gap-2 p-4 text-xs text-foreground/60">
              <Loader2 size={14} className="animate-spin" /> Loading tasks…
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="glass-panel mt-4 p-6 text-center text-sm text-foreground/60">
              {latestUpload.data
                ? "No programme tasks scheduled for this day."
                : "No programme uploaded yet. A project admin can upload one above."}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {activeTasks.map((t) => (
                <li key={t.id} className="glass-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {t.plain_english}
                      </p>
                      <p className="mt-1 text-[0.7rem] uppercase tracking-widest text-foreground/50">
                        <FileText size={10} className="mr-1 inline" />
                        {t.task_name}
                        {t.location ? ` · ${t.location}` : ""}
                        {t.trade ? ` · ${t.trade}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-[0.65rem] uppercase tracking-widest text-foreground/50">
                      {t.start_date} → {t.end_date}
                      <br />
                      {t.allowed_days} day{t.allowed_days === 1 ? "" : "s"} allowed
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-foreground/60">
                      <span>
                        Day {t.day_number} of {t.allowed_days}
                      </span>
                      <span>{t.elapsed_pct}% elapsed</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-alert transition-all"
                        style={{ width: `${t.elapsed_pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Manager notes */}
        <section className="mt-10">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
            Site Manager Global Notes
          </p>
          <h2
            className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Shared Daily Log
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-foreground/60">
            Notes save under your name and sync live to every site manager viewing
            this day.
          </p>

          <div className="glass-panel mt-4 p-4">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              placeholder="Delays, coordination issues, weather, deliveries…"
              className="w-full resize-y rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-alert focus:outline-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={saving || !noteDraft.trim()}
                className="glass-orange inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Save my note
              </button>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {(notes.data ?? []).map((n) => (
              <li key={n.id} className="glass-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] uppercase tracking-widest text-foreground/60">
                      {n.author_name ?? "Site Manager"} ·{" "}
                      {new Date(n.updated_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/90">
                      {n.body}
                    </p>
                  </div>
                  {n.author_id === me && (
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(n.id)}
                      className="text-foreground/40 hover:text-alert"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
            {(notes.data ?? []).length === 0 && (
              <li className="glass-panel p-4 text-center text-xs text-foreground/50">
                No notes yet for this day.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
