import { useEffect, useRef, useState } from "react";
import { Wrench, ShieldAlert, ShoppingBag, FileSearch, ClipboardCheck, Brain, Camera, Scan, Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runOracleCommand, oracleScan } from "@/lib/oracle.functions";
import { ProjectBibleUpload } from "@/components/oracle/ProjectBibleUpload";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { ReportViewer } from "@/components/reports/ReportViewer";

import cmdInstallation from "@/assets/cmd-installation.jpg";
import cmdSafety from "@/assets/cmd-safety.jpg";
import cmdProcurement from "@/assets/cmd-procurement.jpg";
import cmdDrawing from "@/assets/cmd-drawing.jpg";
import cmdSnag from "@/assets/cmd-snag.jpg";
import cmdAssist from "@/assets/cmd-assist.jpg";

const COMMANDS = [
  { key: "installation", label: "Installation Sequence", sub: "Build order & trade coordination", icon: Wrench,         desc: "Step-by-step build & commissioning", image: cmdInstallation, accent: "from-amber-500/20 to-orange-600/30" },
  { key: "safety",       label: "Safety Auditor",        sub: "BSR risk & compliance",            icon: ShieldAlert,    desc: "Risk, RAMS, compliance checks",      image: cmdSafety,       accent: "from-yellow-400/20 to-red-500/30" },
  { key: "procurement",  label: "Procurement",           sub: "Identify & source materials",      icon: ShoppingBag,    desc: "BOMs, vendors, lead times",          image: cmdProcurement,  accent: "from-orange-400/20 to-amber-700/30" },
  { key: "drawing",      label: "Drawing Q&A",           sub: "Symbols, datums, MBC details",     icon: FileSearch,     desc: "Query technical drawings",           image: cmdDrawing,      accent: "from-sky-400/20 to-blue-700/30" },
  { key: "snag",         label: "Snag Master",           sub: "RICS-standard rectification",      icon: ClipboardCheck, desc: "Defect capture & tracking",          image: cmdSnag,         accent: "from-emerald-400/20 to-green-700/30" },
  { key: "assist",       label: "AI Assist",             sub: "Cross-trade problem solving",      icon: Brain,          desc: "On-site knowledge co-pilot",         image: cmdAssist,       accent: "from-lime-400/30 to-emerald-700/40" },
  { key: "scan",         label: "Site Scan",             sub: "Snap & analyse anything on site",  icon: Scan,           desc: "Oracle analyses any site photo",     image: cmdSnag,         accent: "from-purple-400/20 to-violet-700/30" },
];
const PROCESSING_STEPS = [
  "Locking on to project context…",
  "Retrieving drawings & documents…",
  "Cross-referencing site data…",
  "Reasoning through the request…",
  "Composing response…",
];

function OracleProcessing({ label }: { label: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % PROCESSING_STEPS.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="glass-panel relative overflow-hidden p-6">
      {/* Animated scan line */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="oracle-scanline absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-alert/30 to-transparent blur-md" />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-alert/30" />
          <span className="absolute inset-1 rounded-full bg-alert/15" />
          <Sparkles size={20} className="relative animate-pulse text-alert" />
        </div>
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-alert">
            {label} · Processing
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-foreground/80">
            <Loader2 className="animate-spin" size={14} />
            <span key={step} className="animate-fade-in">{PROCESSING_STEPS[step]}</span>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="relative mt-5 flex items-center gap-1.5">
        {PROCESSING_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i <= step ? "bg-alert" : "bg-foreground/10"
            }`}
          />
        ))}
      </div>

      {/* Shimmer bars */}
      <div className="relative mt-5 space-y-2">
        <div className="oracle-shimmer h-2.5 w-3/4 rounded" />
        <div className="oracle-shimmer h-2.5 w-5/6 rounded" />
        <div className="oracle-shimmer h-2.5 w-2/3 rounded" />
      </div>
    </div>
  );
}


const OraclePage = () => {
  const invokeOracle = useServerFn(runOracleCommand);
  const invokeScan = useServerFn(oracleScan);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  // Site Scan state
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanReport, setScanReport] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showScanUi, setShowScanUi] = useState(false);

  async function fileToBase64(file: File): Promise<string> {
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

  const handleScanFile = async (file: File) => {
    setScanError(null);
    setScanReport(null);
    setScanLoading(true);
    setActiveLabel("Site Scan");
    setDialogOpen(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await invokeScan({
        data: { fileName: file.name, mimeType: file.type || "image/jpeg", dataBase64 },
      });
      setScanReport(res.report);
    } catch (e: any) {
      setScanError(e?.message || "Oracle Scan failed.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleInvoke = async (cmd: { key: string; label: string }) => {
    setLoadingKey(cmd.key);
    setError(null);
    setAnswer("");
    setActiveLabel(cmd.label);
    setDialogOpen(true);

    // Read locked oracle context from session (set by "Lock to Oracle" button)
    let localProjectId: string | undefined;
    let lockedContext:
      | { kind: "drawing" | "zone"; id: string; label: string }
      | undefined;
    try {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("oracle:context")
          : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.projectId) localProjectId = parsed.projectId;
        if (parsed?.kind && parsed?.id && parsed?.label) {
          lockedContext = {
            kind: parsed.kind,
            id: parsed.id,
            label: parsed.label,
          };
        }
      }
    } catch {
      // ignore malformed context
    }
    setProjectId(localProjectId);

    try {
      await ensureOracleSession();
      const result = await invokeOracle({
        data: { key: cmd.key, projectId: localProjectId, lockedContext },
      });
      setAnswer(result?.answer ?? "No response returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the Oracle.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background p-6">
      <div className="aurora-bg" />
      <div className="grain-overlay" />

      <div className="relative mx-auto max-w-6xl py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-alert">
          AI · Modules
        </p>
        <h1
          className="mt-3 text-5xl font-extrabold uppercase tracking-tight text-foreground"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Oracle Tooling
        </h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          AI-powered support for site operations.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3">
          {COMMANDS.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isLoading = loadingKey === cmd.key;
            const isScan = cmd.key === "scan";
            return (
              <button
                key={cmd.key}
                type="button"
                disabled={loadingKey !== null || scanLoading}
                onClick={() => {
                  if (isScan) {
                    setShowScanUi(true);
                    cameraRef.current?.click();
                  } else {
                    handleInvoke(cmd);
                  }
                }}
                className="cmd-tile shine animate-fade-up h-36 text-left disabled:cursor-not-allowed disabled:opacity-60"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <img
                  src={cmd.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className={`absolute inset-0 z-[1] bg-gradient-to-tr ${cmd.accent} mix-blend-overlay`} />
                <div className="relative z-[2] flex h-full flex-col justify-between p-3 text-white">
                  <div className="glass-dark inline-flex h-8 w-8 items-center justify-center rounded-lg self-start">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Icon className="h-4 w-4 text-accent" />}
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold leading-tight tracking-tight drop-shadow-md">
                      {cmd.label}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-white/85 drop-shadow">
                      {cmd.sub}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Site Scan photo UI (hidden file inputs) */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setScanPreview(URL.createObjectURL(e.target.files[0]));
              handleScanFile(e.target.files[0]);
            }
          }}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setScanPreview(URL.createObjectURL(e.target.files[0]));
              handleScanFile(e.target.files[0]);
            }
          }}
        />

        {showScanUi && !scanLoading && !scanReport && !scanError && (
          <div className="mt-8 glass-btn rounded-2xl border border-dashed border-white/20 p-10 text-center">
            <Camera className="mx-auto h-12 w-12 text-foreground/50" />
            <p className="mt-4 text-sm uppercase tracking-widest text-foreground/70">Snap or upload a site photo</p>
            <p className="mt-2 text-xs text-muted-foreground">The Oracle will analyse it with full design, architectural, structural and regulatory expertise.</p>
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
                onClick={() => uploadRef.current?.click()}
                className="glass-btn inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm uppercase tracking-widest"
              >
                Upload from device
              </button>
              <button
                type="button"
                onClick={() => setShowScanUi(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-xs uppercase tracking-widest text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {scanPreview && (scanLoading || scanReport || scanError) && (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <img src={scanPreview} alt="Site scan" className="h-full w-full object-cover" />
            </div>
            <div>
              {scanLoading && (
                <div className="glass-btn flex items-center gap-3 rounded-2xl border border-white/10 p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-alert" />
                  <div>
                    <p className="text-sm uppercase tracking-widest text-foreground">The Oracle is scanning…</p>
                    <p className="text-xs text-muted-foreground">Analysing across all six fellowships.</p>
                  </div>
                </div>
              )}
              {scanError && !scanLoading && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
                  <p className="flex items-center gap-2 text-sm text-red-200"><ShieldAlert className="h-4 w-4" /> {scanError}</p>
                  <button
                    type="button"
                    onClick={() => { setScanPreview(null); setShowScanUi(true); cameraRef.current?.click(); }}
                    className="glass-btn mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs uppercase tracking-widest"
                  >Try another photo</button>
                </div>
              )}
              {scanReport && !scanLoading && (
                <div className="glass-btn rounded-xl border border-white/10 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-alert">Assessment</p>
                  <h3 className="mt-1 text-xl font-extrabold text-foreground">{scanReport.assessmentTitle}</h3>
                  {scanReport.tradeInvolved && (
                    <span className="mt-2 inline-block rounded-full border border-white/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-foreground/70">
                      {scanReport.tradeInvolved}
                    </span>
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-foreground/90">{scanReport.summary}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <ProjectBibleUpload />
      </div>

      <ReportViewer
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setAnswer("");
          setError(null);
          setScanReport(null);
          setScanError(null);
          setScanPreview(null);
          setShowScanUi(false);
        }}
        kicker={scanReport ? "Oracle Site Scan" : "Oracle Response"}
        title={scanReport ? scanReport.assessmentTitle || "Site Scan" : activeLabel || "Oracle"}
        subtitle={
          scanReport
            ? `${scanReport.tradeInvolved || "General"} · Priority: ${scanReport.priority} · ${scanReport.keyFindings?.length || 0} findings`
            : loadingKey || scanLoading ? "Processing…" : undefined
        }
        category="Oracle"
        markdown={
          scanReport
            ? [
                `# ${scanReport.assessmentTitle}`,
                "",
                `**Trade:** ${scanReport.tradeInvolved || "General"}  |  **Priority:** ${scanReport.priority}`,
                "",
                "## Summary",
                scanReport.summary || "—",
                "",
                "## Key Findings",
                ...(scanReport.keyFindings || []).map((f: string) => `- ${f}`),
                "",
                "## Recommendations",
                ...(scanReport.recommendations || []).map((r: string) => `- ${r}`),
                "",
                "## Risk Flags",
                ...(scanReport.riskFlags?.length ? (scanReport.riskFlags as string[]).map((f: string) => `- ⚠️ ${f}`) : ["None identified."]),
                "",
                "## Regulatory References",
                ...(scanReport.regulatoryReferences?.length ? (scanReport.regulatoryReferences as string[]).map((r: string) => `- § ${r}`) : ["None cited."]),
              ].join("\n")
            : error
              ? `## Error\n\n${error}`
              : answer
        }
        projectId={projectId}
      >
        {loadingKey !== null || scanLoading ? (
          <div className="glass-panel relative overflow-hidden p-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-alert/30" />
                <Sparkles size={20} className="relative animate-pulse text-alert" />
              </span>
              <div>
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-alert">
                  {activeLabel} · Processing
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-foreground/80">
                  <Loader2 className="animate-spin" size={14} />
                  Composing response…
                </div>
              </div>
            </div>
          </div>
        ) : undefined}
      </ReportViewer>
    </div>
  );
};

export default OraclePage;
