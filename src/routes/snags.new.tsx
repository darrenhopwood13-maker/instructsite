import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ArrowLeft, Save, Trash2, HardHat, Lightbulb, Scale, ShieldAlert, FileText } from "lucide-react";
import { analyzeSnag, createSnag, type SnagReportT } from "@/lib/snags.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { snagReportToMarkdown } from "@/lib/report-format";

export const Route = createFileRoute("/snags/new")({
  head: () => ({
    meta: [{ title: "New Snag — instructSite" }],
  }),
  component: NewSnagPage,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = () => reject(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

function NewSnagPage() {
  const navigate = useNavigate();
  const analyzeFn = useServerFn(analyzeSnag);
  const saveFn = useServerFn(createSnag);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SnagReportT | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setReport(null);
    setPhotoPath(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await analyzeFn({
        data: { fileName: file.name, mimeType: file.type || "image/jpeg", dataBase64 },
      });
      setReport(res.report);
      setPhotoPath(res.photoPath);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.message || "The Foreman couldn't read that photo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!report || !photoPath) return;
    setSaving(true);
    try {
      const { id } = await saveFn({ data: { photoPath, report } });
      navigate({ to: "/snags/$snagId", params: { snagId: id } });
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.message || "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-4xl px-6 py-10">
        <Link to="/snags" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Snag Master
        </Link>

        <h1
          className="mt-6 text-4xl font-extrabold uppercase tracking-tight text-foreground"
          style={{ fontFamily: "'Zen Dots', sans-serif" }}
        >
          New Snag
        </h1>

        {!previewUrl && ready && (
          <div className="glass-btn mt-8 rounded-2xl border border-dashed border-white/20 p-10 text-center">
            <Camera className="mx-auto h-12 w-12 text-foreground/50" />
            <p className="mt-4 text-sm uppercase tracking-widest text-foreground/70">
              Photograph the defect
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              The Foreman will inspect and produce a full site report.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="glass-orange inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-widest"
              >
                <Camera className="h-4 w-4" /> Take Photo
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="glass-btn inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm uppercase tracking-widest"
              >
                Upload from device
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {previewUrl && (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Snag" className="h-full w-full object-cover" />
            </div>

            <div>
              {loading && (
                <div className="glass-btn flex items-center gap-3 rounded-2xl border border-white/10 p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-alert" />
                  <div>
                    <p className="text-sm uppercase tracking-widest text-foreground">The Foreman is inspecting…</p>
                    <p className="text-xs text-muted-foreground">Reading the defect, cross-checking the regs.</p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
                  <p className="flex items-center gap-2 text-sm text-red-200">
                    <ShieldAlert className="h-4 w-4" /> {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setError(null);
                    }}
                    className="glass-btn mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs uppercase tracking-widest"
                  >
                    Try another photo
                  </button>
                </div>
              )}

              {report && !loading && (
                <div className="space-y-5">
                  <ReportView report={report} />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSave}
                      className="glass-orange inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-widest disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save snag
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewUrl(null);
                        setReport(null);
                        setPhotoPath(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-xs uppercase tracking-widest text-foreground/70 hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" /> Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportView({ report }: { report: SnagReportT }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-alert">Defect</p>
        <h2 className="mt-1 text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
          {report.defectTitle}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-widest">
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-foreground/70">{report.trade || "General"}</span>
          <span className="rounded-full border border-alert/40 bg-alert/15 px-2 py-0.5 text-alert">Severity: {report.severity}</span>
        </div>
      </div>

      <div className="glass-btn rounded-xl border border-white/10 p-4">
        <p className="text-xs uppercase tracking-widest text-foreground/60">Description</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{report.description}</p>
      </div>

      <div className="glass-btn rounded-xl border border-white/10 p-4">
        <p className="text-xs uppercase tracking-widest text-foreground/60">Root cause</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{report.cause}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-300">
            <HardHat className="h-4 w-4" /> Rectification A — Proper
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{report.rectificationOptionA}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-blue-300">
            <HardHat className="h-4 w-4" /> Rectification B — Alternative
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{report.rectificationOptionB}</p>
        </div>
      </div>

      {report.tradesmanHack && (
        <div className="rounded-xl border border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-transparent p-5 shadow-[0_0_40px_-15px_rgba(251,191,36,0.6)]">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-300">
            <Lightbulb className="h-4 w-4" /> Tradesman's Hack
          </p>
          <p className="mt-2 text-sm italic leading-relaxed text-amber-100">{report.tradesmanHack}</p>
        </div>
      )}

      {report.regulatoryCitations.length > 0 && (
        <div className="rounded-xl border border-white/10 p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/60">
            <Scale className="h-4 w-4" /> Regulatory Citations
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground/85">
            {report.regulatoryCitations.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-alert">§</span> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.hsNotes && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-red-300">
            <ShieldAlert className="h-4 w-4" /> Health & Safety
          </p>
          <p className="mt-2 text-sm leading-relaxed text-red-100">{report.hsNotes}</p>
        </div>
      )}
    </div>
  );
}
