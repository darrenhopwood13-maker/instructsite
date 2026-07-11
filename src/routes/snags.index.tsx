import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Plus, ShieldAlert, Loader2 } from "lucide-react";
import { listSnags } from "@/lib/snags.functions";
import { getMyOrg } from "@/lib/orgs.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

type StatusFilter = "all" | "open" | "in_progress" | "closed" | "disputed";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
  disputed: "Disputed",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
};

const STATUS_PILL: Record<string, string> = {
  open: "bg-white/10 text-foreground/80",
  in_progress: "bg-blue-500/20 text-blue-200",
  closed: "bg-emerald-500/20 text-emerald-200",
  disputed: "bg-red-500/20 text-red-200",
};

export const Route = createFileRoute("/snags/")({
  head: () => ({
    meta: [
      { title: "Snag Master — instructSite" },
      { name: "description", content: "AI-powered defect inspector. Photograph any snag and get a full site report in seconds." },
    ],
  }),
  component: SnagsPage,
});

function SnagsPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);
  const listFn = useServerFn(listSnags);
  const orgFn = useServerFn(getMyOrg);

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn(), enabled: ready });
  const snags = useQuery({
    queryKey: ["snags", filter],
    queryFn: () => listFn({ data: { status: filter } }),
    enabled: ready && !!org.data,
  });

  if (ready && org.isFetched && !org.data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-alert" />
        <h1 className="mt-4 text-3xl font-extrabold uppercase tracking-tight text-foreground" style={{ fontFamily: "'Zen Dots', sans-serif" }}>
          Join an Organisation
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Snag Master is scoped per organisation. Claim an admin seat or join with an invite link.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/org" className="glass-orange rounded-lg px-5 py-3 text-sm uppercase tracking-widest">
            Set up my org
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
              Defect Intelligence
            </p>
            <h1
              className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Snag Master
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Photograph any defect. The Foreman inspects, cites the regs, and hands you two ways to fix it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/snags/new" })}
            className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-6 py-4 text-sm uppercase tracking-wider"
          >
            <Camera className="h-5 w-5" />
            New Snag
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition ${
                filter === s
                  ? "border-alert bg-alert/20 text-alert"
                  : "border-white/10 text-foreground/60 hover:border-white/30 hover:text-foreground"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {snags.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading snags…
            </div>
          ) : (snags.data ?? []).length === 0 ? (
            <div className="glass-btn rounded-2xl border border-white/10 p-10 text-center">
              <Camera className="mx-auto h-10 w-10 text-foreground/40" />
              <p className="mt-3 text-sm uppercase tracking-widest text-foreground/60">No snags yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Snap a photo of a defect to get your first report.</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/snags/new" })}
                className="glass-orange mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-wider"
              >
                <Plus className="h-4 w-4" /> Add first snag
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {snags.data!.map((s) => (
                <Link
                  key={s.id}
                  to="/snags/$snagId"
                  params={{ snagId: s.id }}
                  className="glass-btn group overflow-hidden rounded-2xl border border-white/10 transition hover:border-alert/50"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photoUrl}
                        alt={s.defect_title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-foreground/30">
                        <Camera className="h-10 w-10" />
                      </div>
                    )}
                    <span
                      className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-widest ${
                        SEVERITY_COLORS[s.severity] ?? SEVERITY_COLORS.medium
                      }`}
                    >
                      {s.severity}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{s.defect_title}</p>
                    <div className="mt-3 flex items-center justify-between text-[0.65rem] uppercase tracking-widest">
                      <span className="text-foreground/50">{s.trade || "General"}</span>
                      <span className={`rounded-full px-2 py-0.5 ${STATUS_PILL[s.status] ?? ""}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-[0.65rem] text-foreground/40">
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
