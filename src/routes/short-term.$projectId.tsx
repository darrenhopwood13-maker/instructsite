import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarRange, Loader2, Lock, Plus } from "lucide-react";
import { getProject } from "@/lib/projects.functions";
import { listShortTermProgrammes } from "@/lib/short-term-programme.functions";
import { STP_STATUS_LABEL, type StpStatus } from "@/lib/short-term-programme";
import { ShortTermProgrammeDetail } from "@/components/project/ShortTermProgrammeDetail";
import { ShortTermProgrammeCreate } from "@/components/project/ShortTermProgrammeCreate";

export const Route = createFileRoute("/short-term/$projectId")({
  head: () => ({
    meta: [
      { title: "Short-Term Programmes — Subcontractor Work Plans | instructSite" },
      {
        name: "description",
        content:
          "Build, agree and track short-term programmes for subcontractors added mid-project — upload an existing plan or build one, then lock it with two-sided acceptance.",
      },
      { property: "og:title", content: "Short-Term Programmes — Subcontractor Work Plans" },
      {
        property: "og:description",
        content:
          "Two-sided agreed mini programmes for subcontractors, locked on acceptance and tracked against verified site progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShortTermProgrammesPage,
});

const STATUS_TONE: Record<StpStatus, string> = {
  draft: "border-white/25 text-foreground/70",
  pending_acceptance: "border-amber-400 bg-amber-400/15 text-amber-300",
  accepted: "border-emerald-400 bg-emerald-400/15 text-emerald-300",
};

function ShortTermProgrammesPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const getP = useServerFn(getProject);
  const listFn = useServerFn(listShortTermProgrammes);

  const [tab, setTab] = useState<"shared" | "private">("shared");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
  });
  const list = useQuery({
    queryKey: ["short-term-programmes", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const programmes = list.data?.programmes ?? [];
  const targets = list.data?.targets ?? [];
  const cap = list.data?.cap ?? 5;


  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link
        to="/projects/$projectId"
        params={{ projectId }}
        className="inline-flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft size={12} /> {project.data?.name ?? "Project"}
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
            Short-Term Programmes
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground">
            Subcontractor work plans
          </h1>
          <p className="mt-1 max-w-xl text-xs text-foreground/60">
            Separate from the master programme. Agreed by both the site manager and the
            subcontractor's PM, then locked — after that it's status flags and comments only.
          </p>
        </div>
        {!openId && tab === "shared" && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={targets.length === 0}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-40"
          >
            <Plus size={13} /> New programme
          </button>
        )}
      </header>

      <div className="mt-4 flex gap-1.5">
        {(
          [
            ["shared", "Agreed with subcontractor"],
            ["private", "My private programmes"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setOpenId(null);
            }}
            className={`rounded-sm border px-3 py-2 font-mono text-[0.55rem] uppercase tracking-widest ${
              tab === key
                ? "border-alert bg-alert/20 text-alert"
                : "border-white/15 text-foreground/55"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "private" ? (
        <div className="mt-5">
          <PrivateProgrammePanel projectId={projectId} />
        </div>
      ) : (
      <div className="mt-5">
        {openId ? (

          <ShortTermProgrammeDetail programmeId={openId} onBack={() => setOpenId(null)} />
        ) : list.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-foreground/60">
            <Loader2 size={14} className="animate-spin" /> Loading programmes…
          </div>
        ) : (
          <div className="space-y-4">
            {targets.length > 0 && (
              <div className="glass-panel p-4">
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-alert">
                  Accepted programme allowance
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {targets.map((t) => (
                    <span
                      key={`${t.inviteId}|${t.packageLabel}`}
                      className="rounded-sm border border-white/15 px-2.5 py-1.5 text-[0.65rem] text-foreground/80"
                    >
                      {t.companyName} · {t.packageLabel} ·{" "}
                      <span
                        className={t.remaining === 0 ? "font-bold text-red-400" : "font-bold text-foreground"}
                      >
                        {t.acceptedCount}/{cap}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {programmes.length === 0 ? (
              <div className="glass-panel p-10 text-center">
                <CalendarRange size={22} className="mx-auto text-foreground/30" />
                <p className="mt-2 text-sm text-foreground/70">No short-term programmes yet.</p>
                <p className="mt-1 text-xs text-foreground/45">
                  {targets.length === 0
                    ? "Invite a subcontractor to a package first — programmes are created against an accepted package."
                    : "Create one from an uploaded programme, or build one with the AI builder."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {programmes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOpenId(p.id)}
                    className="glass-panel flex w-full flex-wrap items-center gap-3 p-4 text-left transition hover:border-alert/60"
                  >
                    <div className="min-w-[12rem] flex-1">
                      <p className="font-mono text-[0.55rem] uppercase tracking-[0.28em] text-foreground/45">
                        {p.companyName} · {p.packageLabel}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">{p.title}</p>
                      <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/45">
                        {p.taskCount} tasks · via {p.createdVia === "upload" ? "upload" : "AI builder"} ·{" "}
                        {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      {p.status === "accepted" && <Lock size={12} className="text-emerald-300" />}
                      <span
                        className={`rounded-sm border px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest ${
                          STATUS_TONE[p.status as StpStatus] ?? "border-white/20 text-foreground/60"
                        }`}
                      >
                        {STP_STATUS_LABEL[p.status as StpStatus] ?? p.status}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}


      {creating && (
        <ShortTermProgrammeCreate
          projectId={projectId}
          targets={targets}
          cap={cap}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["short-term-programmes", projectId] });
            setOpenId(id);
          }}
        />
      )}
    </main>
  );
}
