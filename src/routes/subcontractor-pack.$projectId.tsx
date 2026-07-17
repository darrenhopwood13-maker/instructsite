import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, ShieldCheck, ClipboardList, CalendarClock, Send, Upload, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { getProject } from "@/lib/projects.functions";
import {
  getMyCompanyForProject,
  getSubcontractorPack,
  addWorker,
  addRegister,
  addToolboxTalk,
  addLookAhead,
  getComplianceSignedUrl,
  checkWorkerDuplicate,
  checkRegisterDuplicate,
  TOOLBOX_TOPIC_OPTIONS,
  REGISTER_TYPE_OPTIONS,
} from "@/lib/subcontractor-pack.functions";
import { generateWeeklyPackPdf } from "@/lib/weekly-pack-pdf";

import { AccessDeniedScreen } from "@/components/project/AccessDeniedScreen";

export const Route = createFileRoute("/subcontractor-pack/$projectId")({
  head: () => ({ meta: [{ title: "Subcontractors Pack — InstructSite" }] }),
  component: SubPackPage,
});

type Tab = "hub" | "log";

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">{eyebrow}</p>
      <h2
        className="mt-1 text-xl font-extrabold uppercase tracking-tight text-foreground"
        style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
      >
        {title}
      </h2>
    </div>
  );
}

function inputCls() {
  return "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert";
}

function primaryBtn(extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md border-2 border-alert bg-alert/10 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-alert hover:bg-alert hover:text-black transition-colors ${extra}`;
}

function ghostBtn(extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert ${extra}`;
}

function SubPackPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("hub");
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLocked, setCompanyLocked] = useState(false);

  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const getP = useServerFn(getProject);
  const getCoFn = useServerFn(getMyCompanyForProject);
  const getPackFn = useServerFn(getSubcontractorPack);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });

  const myCompany = useQuery({
    queryKey: ["my-company", projectId],
    queryFn: () => getCoFn({ data: { projectId } }),
    enabled: ready,
  });

  useEffect(() => {
    const c = myCompany.data?.companyName;
    if (c && !companyLocked) {
      setCompanyName(c);
      setCompanyLocked(true);
    }
  }, [myCompany.data, companyLocked]);

  const pack = useQuery({
    queryKey: ["sub-pack", projectId, companyName],
    queryFn: () => getPackFn({ data: { projectId, companyName } }),
    enabled: ready && companyLocked && !!companyName,
  });

  const subId = pack.data?.subcontractor?.id as string | undefined;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sub-pack", projectId, companyName] });

  if (project.isError) return <AccessDeniedScreen message={(project.error as Error)?.message} />;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/dabs/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={12} /> {project.data?.name ?? "Project"} · DABS
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Subcontractors Pack
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              {companyLocked ? companyName : "Set your company to begin"} · Weekly compliance & labour submission
            </p>
          </div>
          <SubmitWeeklyPackButton
            disabled={!pack.data || !companyLocked}
            projectName={project.data?.name ?? "Project"}
            companyName={companyName}
            pack={pack.data}
          />
        </div>

        {!companyLocked && (
          <div className="glass-panel mt-6 p-5">
            <SectionHeader eyebrow="Setup" title="Confirm your company" />
            <p className="mt-2 text-xs text-foreground/60">
              We couldn't detect your company from an invite. Enter it once — it'll be linked to this project.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name (e.g. Apex Electrical Ltd)"
                className={inputCls() + " max-w-md"}
              />
              <button
                type="button"
                onClick={() => companyName.trim() && setCompanyLocked(true)}
                className={primaryBtn()}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {companyLocked && (
          <>
            <div className="mt-6 inline-flex rounded-md border border-white/15 bg-black/30 p-1">
              {(["hub", "log"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.28em] transition-colors ${
                    tab === t ? "bg-alert text-black" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {t === "hub" ? "Hub" : "Daily Log"}
                </button>
              ))}
            </div>

            {pack.isLoading && (
              <div className="glass-panel mt-6 flex items-center gap-2 p-5 text-xs text-foreground/60">
                <Loader2 size={14} className="animate-spin" /> Loading pack…
              </div>
            )}

            {tab === "hub" && pack.data && <HubView pack={pack.data} />}
            {tab === "log" && subId && <DailyLogView subId={subId} projectId={projectId} onSaved={invalidate} />}
          </>
        )}
      </div>
    </div>
  );
}

function SubmitWeeklyPackButton({
  disabled,
  projectName,
  companyName,
  pack,
}: {
  disabled: boolean;
  projectName: string;
  companyName: string;
  pack: any;
}) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (!pack) return;
    setBusy(true);
    try {
      const { filename } = await generateWeeklyPackPdf({
        projectName,
        companyName,
        workers: pack.workers ?? [],
        registers: pack.registers ?? [],
        toolboxTalks: pack.toolboxTalks ?? [],
        lookAheads: pack.lookAheads ?? [],
      });
      toast.success("Weekly Pack Generated Successfully", { description: filename });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={primaryBtn(disabled || busy ? "opacity-70 cursor-not-allowed" : "")}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      {busy ? "Generating Pack…" : "Submit Weekly Pack"}
    </button>
  );
}


function HubView({ pack }: { pack: any }) {
  const getSig = useServerFn(getComplianceSignedUrl);
  const openDoc = async (path?: string | null) => {
    if (!path) return;
    try {
      const { url } = await getSig({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot open file");
    }
  };
  const latestAhead = pack.lookAheads?.[0];
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Labour Roster" title={`${pack.workers.length} active`} />
        <ul className="mt-4 space-y-2">
          {pack.workers.length === 0 && (
            <li className="text-xs text-foreground/50">No workers logged yet.</li>
          )}
          {pack.workers.map((w: any) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{w.name}</p>
                <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {w.role || "—"}
                </p>
              </div>
              {w.competency_card_url && (
                <button type="button" onClick={() => openDoc(w.competency_card_url)} className={ghostBtn()}>
                  <ExternalLink size={11} /> Card
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Equipment Registers" title={`${pack.registers.length} assets`} />
        <ul className="mt-4 space-y-2">
          {pack.registers.length === 0 && (
            <li className="text-xs text-foreground/50">No registers yet.</li>
          )}
          {pack.registers.map((r: any) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-alert/60 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-alert">
                    {r.type}
                  </span>
                  <p className="truncate text-sm font-bold text-foreground">{r.asset_name || "—"}</p>
                </div>
                <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : "No date"}
                </p>
              </div>
              {r.certificate_url && (
                <button type="button" onClick={() => openDoc(r.certificate_url)} className={ghostBtn()}>
                  <ExternalLink size={11} /> Cert
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Recent Toolbox Talks" title={`${pack.toolboxTalks.length} recent`} />
        <ul className="mt-4 space-y-2">
          {pack.toolboxTalks.length === 0 && (
            <li className="text-xs text-foreground/50">No talks logged.</li>
          )}
          {pack.toolboxTalks.slice(0, 5).map((t: any) => {
            const attendees = Array.isArray(t.attendance_list) ? t.attendance_list : [];
            return (
              <li key={t.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">{t.topic || "—"}</p>
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {t.date ? new Date(t.date).toLocaleDateString() : ""}
                  </p>
                </div>
                <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                  {attendees.length} attendees
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="glass-panel p-5">
        <SectionHeader eyebrow="Current Look-Ahead" title={latestAhead ? new Date(latestAhead.date).toLocaleDateString() : "Nothing planned"} />
        {latestAhead ? (
          <div className="mt-4 space-y-3">
            <p className="whitespace-pre-wrap text-sm text-foreground/85">{latestAhead.work_plan}</p>
            <div className="flex flex-wrap gap-2">
              {latestAhead.is_high_risk && (
                <span className="rounded-sm border border-red-500 bg-red-600/20 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-red-300">
                  High Risk
                </span>
              )}
              {latestAhead.permit_required && (
                <span className="rounded-sm border border-amber-400 bg-amber-400/10 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-amber-300">
                  Permit Required
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-foreground/50">Add a look-ahead in the Daily Log tab.</p>
        )}
      </div>
    </div>
  );
}

function AccordionCard({
  icon,
  eyebrow,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="glass-accent flex h-10 w-10 items-center justify-center">{icon}</div>
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">{eyebrow}</p>
            <p
              className="mt-0.5 text-lg font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {title}
            </p>
          </div>
        </div>
        <span className="font-mono text-xs text-foreground/50">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-white/10 px-5 py-5">{children}</div>}
    </div>
  );
}

const MAX_UPLOAD_MB = 20;

async function uploadCompliance(
  projectId: string,
  subfolder: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`File exceeds ${MAX_UPLOAD_MB}MB limit`);
  }
  const user = await ensureOracleSession();
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${user.id}/${projectId}/${subfolder}/${Date.now()}-${safe}`;

  const { data: signed, error: signErr } = await supabase.storage
    .from("compliance-docs")
    .createSignedUploadUrl(path);
  if (signErr || !signed) {
    throw new Error(signErr?.message || "Could not prepare upload");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}) — ${xhr.responseText?.slice(0, 160) || "storage error"}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(file);
  });

  return path;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-alert transition-all duration-150"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/60">
        Uploading · {pct}%
      </p>
    </div>
  );
}


function DailyLogView({
  subId,
  projectId,
  onSaved,
}: {
  subId: string;
  projectId: string;
  onSaved: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <AddLabour subId={subId} projectId={projectId} onSaved={onSaved} />
      <AddRegister subId={subId} projectId={projectId} onSaved={onSaved} />
      <AddToolboxTalk subId={subId} onSaved={onSaved} />
      <AddLookAhead subId={subId} onSaved={onSaved} />
    </div>
  );
}

function AddLabour({ subId, projectId, onSaved }: { subId: string; projectId: string; onSaved: () => void }) {
  const fn = useServerFn(addWorker);
  const dupeFn = useServerFn(checkWorkerDuplicate);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const submit = async () => {
    if (!name.trim()) {
      toast.error("Worker name required");
      return;
    }
    setBusy(true);
    setPct(0);
    try {
      if (file) {
        const dupe = await dupeFn({ data: { subcontractorId: subId, name: name.trim() } });
        if (dupe.hasCard) {
          const ok = window.confirm(
            `A competency card is already on file for "${name.trim()}"${dupe.sameDay ? " (uploaded today)" : ""}. Upload another anyway?`,
          );
          if (!ok) {
            toast.message("Upload cancelled");
            setBusy(false);
            return;
          }
        }
      }
      let url: string | null = null;
      if (file) {
        try {
          url = await uploadCompliance(projectId, `workers/${subId}`, file, setPct);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Card upload failed", {
            description: "The worker was not saved. Try a smaller file or check your connection.",
          });
          setBusy(false);
          setPct(0);
          return;
        }
      }
      await fn({ data: { subcontractorId: subId, name, role: role || null, competencyCardUrl: url } });
      toast.success("Worker added");
      setName("");
      setRole("");
      setFile(null);
      setPct(0);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccordionCard icon={<Users size={18} />} eyebrow="01" title="Add Labour" defaultOpen>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Name
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Role
          </span>
          <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls()} placeholder="e.g. Electrician" />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Competency Card (PDF / Image · max {MAX_UPLOAD_MB}MB)
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-alert/20 file:px-3 file:py-2 file:text-[0.65rem] file:font-bold file:uppercase file:tracking-widest file:text-alert hover:file:bg-alert/30"
          />
          {file && <p className="mt-1 font-mono text-[0.65rem] text-foreground/50">{file.name}</p>}
          {busy && file && <ProgressBar pct={pct} />}
        </label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Worker
      </button>
    </AccordionCard>
  );
}


function AddRegister({ subId, projectId, onSaved }: { subId: string; projectId: string; onSaved: () => void }) {
  const fn = useServerFn(addRegister);
  const dupeFn = useServerFn(checkRegisterDuplicate);
  const [type, setType] = useState<(typeof REGISTER_TYPE_OPTIONS)[number]>("PUWER");
  const [asset, setAsset] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const submit = async () => {
    setBusy(true);
    setPct(0);
    try {
      if (file) {
        const dupe = await dupeFn({
          data: {
            subcontractorId: subId,
            type,
            assetName: asset || null,
            inspectionDate: date || null,
          },
        });
        if (dupe.hasCert) {
          const parts = [type, asset || "asset", date || "same date"].join(" · ");
          const ok = window.confirm(
            `A certificate already exists for ${parts}. Upload another anyway?`,
          );
          if (!ok) {
            toast.message("Upload cancelled");
            setBusy(false);
            return;
          }
        }
      }
      let url: string | null = null;
      if (file) {
        try {
          url = await uploadCompliance(projectId, `registers/${subId}`, file, setPct);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Certificate upload failed", {
            description: "The register entry was not saved. Try a smaller file or check your connection.",
          });
          setBusy(false);
          setPct(0);
          return;
        }
      }
      await fn({
        data: {
          subcontractorId: subId,
          type,
          assetName: asset || null,
          inspectionDate: date || null,
          certificateUrl: url,
        },
      });
      toast.success("Register entry saved");
      setAsset("");
      setDate("");
      setFile(null);
      setPct(0);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccordionCard icon={<ShieldCheck size={18} />} eyebrow="02" title="Safety Registers">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Type
          </span>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls()}>
            {REGISTER_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Asset Name
          </span>
          <input value={asset} onChange={(e) => setAsset(e.target.value)} className={inputCls()} placeholder="e.g. 110V Transformer" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Inspection Date
          </span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls()} />
        </label>
        <label className="block md:col-span-3">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Certificate (PDF / Image · max {MAX_UPLOAD_MB}MB)
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-alert/20 file:px-3 file:py-2 file:text-[0.65rem] file:font-bold file:uppercase file:tracking-widest file:text-alert hover:file:bg-alert/30"
          />
          {file && <p className="mt-1 font-mono text-[0.65rem] text-foreground/50">{file.name}</p>}
          {busy && file && <ProgressBar pct={pct} />}
        </label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Register
      </button>
    </AccordionCard>
  );
}


function AddToolboxTalk({ subId, onSaved }: { subId: string; onSaved: () => void }) {
  const fn = useServerFn(addToolboxTalk);
  const [topic, setTopic] = useState<(typeof TOOLBOX_TOPIC_OPTIONS)[number]>("Manual Handling");
  const [attendees, setAttendees] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const list = attendees.split("\n").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      toast.error("Add at least one attendee");
      return;
    }
    setBusy(true);
    try {
      await fn({ data: { subcontractorId: subId, topic, attendees: list } });
      toast.success("Toolbox talk logged");
      setAttendees("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccordionCard icon={<ClipboardList size={18} />} eyebrow="03" title="Toolbox Talk">
      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Topic
          </span>
          <select value={topic} onChange={(e) => setTopic(e.target.value as any)} className={inputCls()}>
            {TOOLBOX_TOPIC_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Attendees (one per line)
          </span>
          <textarea
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            rows={5}
            className={inputCls()}
            placeholder={"J. Smith\nR. Patel\nM. O'Neill"}
          />
        </label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Talk
      </button>
    </AccordionCard>
  );
}

function AddLookAhead({ subId, onSaved }: { subId: string; onSaved: () => void }) {
  const fn = useServerFn(addLookAhead);
  const [plan, setPlan] = useState("");
  const [highRisk, setHighRisk] = useState(false);
  const [permit, setPermit] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!plan.trim()) {
      toast.error("Work plan required");
      return;
    }
    setBusy(true);
    try {
      await fn({
        data: { subcontractorId: subId, workPlan: plan, isHighRisk: highRisk, permitRequired: permit },
      });
      toast.success("Look-ahead saved");
      setPlan("");
      setHighRisk(false);
      setPermit(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccordionCard icon={<CalendarClock size={18} />} eyebrow="04" title="Look-Ahead">
      <label className="block">
        <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
          Work Plan
        </span>
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          rows={5}
          className={inputCls()}
          placeholder="Detail the planned works for the coming week…"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/70">
          <input type="checkbox" checked={highRisk} onChange={(e) => setHighRisk(e.target.checked)} className="h-4 w-4 accent-red-500" />
          High Risk
        </label>
        <label className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/70">
          <input type="checkbox" checked={permit} onChange={(e) => setPermit(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          Permit Required
        </label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Look-Ahead
      </button>
    </AccordionCard>
  );
}
