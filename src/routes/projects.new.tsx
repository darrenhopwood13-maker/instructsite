import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  UploadCloud,
  X,
  Sparkles,
  Users,
  HardHat,
} from "lucide-react";
import { createProject, getMyRoles, listMyOrgsForProjectCreation } from "@/lib/projects.functions";
import { registerTier1Document } from "@/lib/tier1-uploads.functions";
import { extractProjectFromDrawing } from "@/lib/ai-extract-project.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [{ title: "New Project — instructSite" }],
  }),
  component: NewProject,
});

function humanizeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  if (!raw) return "Something went wrong. Please try again.";
  if (/unauthor/i.test(raw)) return "Your session expired. Refresh the page and sign in again.";
  if (/master admin/i.test(raw)) return "You need Master Admin access to create a project.";
  if (/storage|bucket|object/i.test(raw))
    return "The project was created, but a document upload failed. Open the project dashboard and try that upload again.";
  if (/row-level security|permission denied|rls/i.test(raw))
    return "Database blocked the write. Your account is missing the required permissions.";
  if (/network|fetch|failed to fetch/i.test(raw))
    return "Couldn't reach the backend. Check your connection and retry.";
  if (/429|rate limit/i.test(raw))
    return "Oracle is busy (rate-limited). Wait a moment and try again.";
  if (/402|credit/i.test(raw))
    return "AI credits exhausted for this workspace. Top up credits to continue.";
  return raw;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function NewProject() {
  const nav = useNavigate();
  const create = useServerFn(createProject);
  const rolesFn = useServerFn(getMyRoles);
  const orgsFn = useServerFn(listMyOrgsForProjectCreation);
  const register = useServerFn(registerTier1Document);
  const extract = useServerFn(extractProjectFromDrawing);

  const [ready, setReady] = useState(false);
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [scopeBrief, setScopeBrief] = useState("");
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [logisticsFiles, setLogisticsFiles] = useState<File[]>([]);
  const [ramsFiles, setRamsFiles] = useState<File[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string>("");

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureOracleSession();
        const [r, o] = await Promise.all([rolesFn(), orgsFn()]);
        setIsMaster(r.roles.includes("master_admin"));
        setOrgs(o);
        if (o.length === 1) setOrgId(o[0].id);
      } catch (e) {
        setErr(humanizeError(e));
        setIsMaster(false);
      } finally {
        setReady(true);
      }
    })();
  }, [rolesFn, orgsFn]);

  const flashFilled = (keys: string[]) => {
    const map: Record<string, boolean> = {};
    keys.forEach((k) => (map[k] = true));
    setAutoFilled(map);
    setTimeout(() => setAutoFilled({}), 2200);
  };

  const runAiScan = async (file: File) => {
    if (!canCreate || scanning) return;
    setErr(null);
    setScanning(true);
    setScanMsg("InstructBrain Oracle is dissecting drawing pack data…");
    setScanProgress(6);
    progressTimer.current = setInterval(() => {
      setScanProgress((p) => (p >= 92 ? 92 : p + Math.max(1, Math.round((94 - p) / 18))));
    }, 350);
    try {
      const dataBase64 = await fileToBase64(file);
      const out = await extract({
        data: { fileName: file.name, mimeType: file.type || "application/pdf", dataBase64 },
      });
      const filled: string[] = [];
      if (out.projectName) {
        setName(out.projectName);
        filled.push("name");
      }
      if (out.siteAddress) {
        setSiteAddress(out.siteAddress);
        filled.push("addr");
      }
      if (out.clientName) {
        setClientName(out.clientName);
        filled.push("client");
      }
      if (out.mainContractor) {
        setMainContractor(out.mainContractor);
        filled.push("mc");
      }
      if (out.projectBrief) {
        setScopeBrief(out.projectBrief);
        filled.push("brief");
      }
      // Queue this file into GA Drawings so it uploads on submit
      setDrawingFiles((prev) => [...prev, file]);
      setScanProgress(100);
      setScanMsg(
        filled.length
          ? `Oracle extracted ${filled.length} field${filled.length === 1 ? "" : "s"}. Review & confirm.`
          : "Oracle couldn't confidently read this pack. Fill fields manually.",
      );
      flashFilled(filled);
    } catch (e) {
      setErr(humanizeError(e));
      setScanMsg(null);
    } finally {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setTimeout(() => {
        setScanning(false);
        setScanProgress(0);
      }, 700);
    }
  };

  const canCreate = orgs.length > 0;
  const canSubmit = name.trim().length > 0 && siteAddress.trim().length > 0 && orgId.length > 0 && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      const user = await ensureOracleSession();
      const briefParts = [
        clientName.trim() && `Client / End User: ${clientName.trim()}`,
        mainContractor.trim() && `Main Contractor: ${mainContractor.trim()}`,
        scopeBrief.trim(),
      ].filter(Boolean);
      const { id } = await create({
        data: {
          orgId,
          name: name.trim(),
          siteAddress: siteAddress.trim(),
          scopeBrief: briefParts.join("\n\n"),
        },
      });
      await uploadQueuedFiles(id, user.id, "drawing", drawingFiles, register);
      await uploadQueuedFiles(id, user.id, "logistics", logisticsFiles, register);
      await uploadQueuedFiles(id, user.id, "rams", ramsFiles, register);
      nav({ to: "/projects/$projectId", params: { projectId: id } });
    } catch (e) {
      setErr(humanizeError(e));
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-alert"
        >
          <ArrowLeft size={12} /> Back to Projects
        </Link>
        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">
          Onboarding
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          New Project
        </h1>
        <p className="mt-2 max-w-xl text-sm text-foreground/60">
          Drop a GA drawing pack for instant AI auto-fill, or complete the fields manually.
        </p>

        {ready && !canCreate && (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-alert/50 bg-alert/10 p-4 text-sm text-foreground">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-alert" />
            <div>
              <p className="font-bold uppercase tracking-widest text-alert">Access denied</p>
              <p className="mt-1 text-foreground/80">
                You need to be an Organisation Admin (or Founder) to onboard new projects.
              </p>
            </div>
          </div>
        )}

        {/* AI Instant Setup */}
        <AiDropZone
          disabled={!canCreate || scanning}
          scanning={scanning}
          progress={scanProgress}
          message={scanMsg}
          onFile={runAiScan}
        />

        <form onSubmit={submit} className="glass-panel mt-6 space-y-6 p-6">
          <Field label="Organisation" icon={<Building2 size={14} />} required>
            <select
              disabled={!canCreate}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">Select organisation…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Project Name" icon={<Building2 size={14} />} required flash={autoFilled.name}>
            <input
              autoFocus
              disabled={!canCreate}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="e.g. Riverside Tower Phase 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Full Site Address" icon={<MapPin size={14} />} required flash={autoFilled.addr}>
            <textarea
              rows={2}
              disabled={!canCreate}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="Street, city, postcode"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client / End User" icon={<Users size={14} />} flash={autoFilled.client}>
              <input
                disabled={!canCreate}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
                placeholder="e.g. Riverside Developments Ltd"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </Field>
            <Field label="Main Contractor" icon={<HardHat size={14} />} flash={autoFilled.mc}>
              <input
                disabled={!canCreate}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
                placeholder="e.g. BuildCo Construction"
                value={mainContractor}
                onChange={(e) => setMainContractor(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Project Brief / Scope of Works" icon={<FileText size={14} />} flash={autoFilled.brief}>
            <textarea
              rows={5}
              disabled={!canCreate}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-foreground outline-none focus:border-alert disabled:opacity-50"
              placeholder="Scope, contract value, key trades, high-risk activities, key dates…"
              value={scopeBrief}
              onChange={(e) => setScopeBrief(e.target.value)}
            />
          </Field>

          <section>
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-widest text-foreground/70">
              Document Uploads
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <QueuedDropZone
                title="GA Drawings"
                subtitle="PDF drawings / plans"
                disabled={!canCreate || saving}
                files={drawingFiles}
                onFiles={setDrawingFiles}
              />
              <QueuedDropZone
                title="Site Logistics"
                subtitle="Logistics plan files"
                disabled={!canCreate || saving}
                files={logisticsFiles}
                onFiles={setLogisticsFiles}
              />
              <QueuedDropZone
                title="Master RAMS"
                subtitle="RAMS documents"
                disabled={!canCreate || saving}
                files={ramsFiles}
                onFiles={setRamsFiles}
              />
            </div>
          </section>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-alert/50 bg-alert/10 p-3 text-sm text-foreground">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-alert" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Link
              to="/projects"
              className="glass-btn rounded-xl px-4 py-2.5 text-sm uppercase tracking-wider"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || !canCreate}
              className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm uppercase tracking-wider disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Creating…
                </>
              ) : (
                "Confirm Project Creation"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  required,
  children,
  flash,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  flash?: boolean;
}) {
  return (
    <label className={`block rounded-md transition-all duration-500 ${flash ? "ring-2 ring-alert/70 shadow-[0_0_24px_rgba(255,120,0,0.35)]" : ""}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-widest text-foreground/70">
        {icon} {label}
        {required && <span className="text-alert">*</span>}
        {flash && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-alert/20 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-widest text-alert">
            <Sparkles size={9} /> AI
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function AiDropZone({
  disabled,
  scanning,
  progress,
  message,
  onFile,
}: {
  disabled?: boolean;
  scanning: boolean;
  progress: number;
  message: string | null;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const pick = (files: FileList | null) => {
    if (!files || !files[0]) return;
    onFile(files[0]);
  };
  return (
    <div className="mt-8 rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-alert/10 p-[1px] shadow-[0_0_40px_rgba(56,189,248,0.15)]">
      <div className="rounded-2xl bg-black/50 p-5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-sky-300" />
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-sky-300">
            Instant AI Setup
          </p>
        </div>
        <h2
          className="mt-1 text-xl font-extrabold uppercase tracking-tight text-foreground md:text-2xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Drop Drawing Pack Here
        </h2>
        <p className="mt-1 text-xs text-foreground/60">
          Powered by Gemini 2.5 Pro. Oracle reads title blocks & cover sheets to auto-fill project details.
        </p>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) pick(e.dataTransfer.files);
          }}
          className={`mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? "border-sky-300 bg-sky-400/10"
              : "border-sky-400/40 bg-black/30"
          } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-sky-300"}`}
        >
          <UploadCloud size={26} className="text-sky-300" />
          <span className="mt-3 text-sm font-extrabold uppercase tracking-wider text-foreground">
            Drop a GA PDF or title-block image
          </span>
          <span className="mt-1 text-[0.65rem] uppercase tracking-widest text-foreground/50">
            PDF · PNG · JPG — single file
          </span>
          <input
            type="file"
            disabled={disabled}
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {(scanning || message) && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-200">
              {scanning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span className="oracle-pulse">{message}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="oracle-bar h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-sky-300 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type DocType = "drawing" | "logistics" | "rams";

async function uploadQueuedFiles(
  projectId: string,
  userId: string,
  docType: DocType,
  files: File[],
  register: ReturnType<typeof useServerFn<typeof registerTier1Document>>,
) {
  for (const file of files) {
    const path = `${userId}/${projectId}/${docType}/${Date.now()}-${file.name.replace(
      /[^\w.\-]+/g,
      "_",
    )}`;
    const { error: uploadError } = await supabase.storage
      .from("project-bible")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;

    await register({
      data: {
        projectId,
        docType,
        fileName: file.name,
        filePath: path,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        tradePackage: docType === "rams" ? "General" : undefined,
      },
    });
  }
}

function QueuedDropZone({
  title,
  subtitle,
  files,
  disabled,
  onFiles,
}: {
  title: string;
  subtitle: string;
  files: File[];
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const addFiles = (next: FileList | null) => {
    if (!next) return;
    onFiles([...files, ...Array.from(next)]);
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragging ? "border-alert bg-alert/10" : "border-alert/35 bg-black/25"
        } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-alert"}`}
      >
        <UploadCloud size={24} className="text-alert" />
        <span className="mt-3 text-sm font-extrabold uppercase tracking-wider text-foreground">
          {title}
        </span>
        <span className="mt-1 text-[0.65rem] uppercase tracking-widest text-foreground/50">
          {subtitle}
        </span>
        <span className="mt-2 text-[0.65rem] uppercase tracking-widest text-foreground/40">
          Drop files or click
        </span>
        <input
          type="file"
          multiple
          disabled={disabled}
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5"
            >
              <FileText size={13} className="text-foreground/60" />
              <span className="min-w-0 flex-1 truncate text-[0.7rem] font-mono text-foreground/80">
                {file.name}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFiles(files.filter((_, i) => i !== index))}
                className="text-foreground/40 hover:text-alert disabled:opacity-40"
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
