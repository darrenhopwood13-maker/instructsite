import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send, X, ZoomIn, FileText } from "lucide-react";
import { getSnag, updateSnagStatus, postSnagComment } from "@/lib/snags.functions";
import { ReportView } from "./snags.new";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { snagReportToMarkdown } from "@/lib/report-format";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";

const STATUS_OPTIONS = [
  { v: "open", label: "Open" },
  { v: "in_progress", label: "In Progress" },
  { v: "closed", label: "Closed" },
  { v: "disputed", label: "Disputed" },
] as const;

export const Route = createFileRoute("/snags/$snagId")({
  head: () => ({ meta: [{ title: "Snag — instructSite" }] }),
  component: SnagDetail,
});

function SnagDetail() {
  const { snagId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getSnag);
  const statusFn = useServerFn(updateSnagStatus);
  const commentFn = useServerFn(postSnagComment);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const q = useQuery({
    queryKey: ["snag", snagId],
    queryFn: () => getFn({ data: { snagId } }),
    enabled: ready,
  });

  const snag = q.data?.snag;
  const comments = q.data?.comments ?? [];
  const photoUrl = q.data?.photoUrl;

  async function changeStatus(v: string) {
    if (!snag) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await statusFn({ data: { snagId, status: v as any } });
    qc.invalidateQueries({ queryKey: ["snag", snagId] });
    qc.invalidateQueries({ queryKey: ["snags"] });
  }

  async function sendComment() {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await commentFn({ data: { snagId, body: comment.trim() } });
      setComment("");
      qc.invalidateQueries({ queryKey: ["snag", snagId] });
    } finally {
      setPosting(false);
    }
  }

  if (q.isLoading || !ready) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!snag) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Snag not found.</p>
        <Link to="/snags" className="glass-btn mt-4 inline-flex rounded-lg px-4 py-2 text-xs uppercase tracking-widest">
          Back
        </Link>
      </div>
    );
  }

  const report = {
    defectTitle: snag.defect_title,
    description: snag.description || "",
    cause: snag.cause || "",
    rectificationOptionA: snag.rectification_option_a || "",
    rectificationOptionB: snag.rectification_option_b || "",
    tradesmanHack: snag.tradesman_hack || "",
    regulatoryCitations: (snag.regulatory_citations as string[]) || [],
    hsNotes: snag.hs_notes || "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    severity: snag.severity as any,
    trade: snag.trade || "",
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Link to="/snags" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Snag Master
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setZoom(true)}
                className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt={snag.defect_title} className="w-full object-cover" />
                <span className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" />
                </span>
              </button>
            )}

            <div className="glass-btn mt-5 rounded-xl border border-white/10 p-4">
              <p className="text-[0.65rem] uppercase tracking-widest text-foreground/60">Status</p>
              <select
                value={snag.status}
                onChange={(e) => changeStatus(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground focus:border-alert focus:outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-[0.65rem] uppercase tracking-widest text-foreground/40">
                Logged {new Date(snag.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <ReportView report={report} />

            <section className="mt-8">
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-alert">Site Manager's Log</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Comments</h3>

              <div className="mt-4 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No entries yet.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[0.6rem] uppercase tracking-widest text-foreground/40">
                        {new Date(c.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground/90">{c.body}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder="Add a note to the log…"
                  className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:border-alert focus:outline-none"
                />
                <button
                  type="button"
                  disabled={posting || !comment.trim()}
                  onClick={sendComment}
                  className="glass-orange inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {zoom && photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={snag.defect_title} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
