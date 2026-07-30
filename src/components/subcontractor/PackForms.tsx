import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, ShieldCheck, ClipboardList, CalendarClock, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import {
  addWorker,
  addRegister,
  addToolboxTalk,
  addLookAhead,
  checkWorkerDuplicate,
  checkRegisterDuplicate,
  TOOLBOX_TOPIC_OPTIONS,
  REGISTER_TYPE_OPTIONS,
} from "@/lib/subcontractor-pack.functions";

export const MAX_UPLOAD_MB = 20;

export function inputCls() {
  return "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert";
}

export function primaryBtn(extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md border-2 border-alert bg-alert/10 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-alert hover:bg-alert hover:text-black transition-colors ${extra}`;
}

export function ghostBtn(extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert ${extra}`;
}

export function RecordedByBadge() {
  return (
    <span className="rounded-sm border border-sky-400/70 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[0.5rem] font-bold uppercase tracking-widest text-sky-300">
      Recorded by Site Manager
    </span>
  );
}

export function AccordionCard({
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

export async function uploadCompliance(
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

export function ProgressBar({ pct }: { pct: number }) {
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

const FILE_ACCEPT = "application/pdf,image/*,.heic,.heif,.txt,.doc,.docx,.xls,.xlsx";
const fileInputCls =
  "block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-alert/20 file:px-3 file:py-2 file:text-[0.65rem] file:font-bold file:uppercase file:tracking-widest file:text-alert hover:file:bg-alert/30";

function Label({ text, children, span }: { text: string; children: React.ReactNode; span?: string }) {
  return (
    <label className={`block ${span ?? ""}`}>
      <span className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
        {text}
      </span>
      {children}
    </label>
  );
}

/**
 * Non-blocking replacement for window.confirm().
 *
 * window.confirm() halts the renderer's main thread, and inside the published
 * app's iframe (no allow-modals) Chrome suppresses the dialog entirely — the
 * tab appears frozen and the save silently never runs. This renders an in-app
 * dialog and resolves a promise instead.
 */
function useConfirm() {
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((msg: string, label = "Confirm") => {
    setMessage(msg);
    setConfirmLabel(label);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    setMessage(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(v);
  }, []);

  const dialog = message ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
      <div className="glass-panel w-full max-w-md p-5">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">Verify</p>
        <pre className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-mono text-xs text-foreground/85">
          {message}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => settle(false)} className={ghostBtn()}>
            Cancel
          </button>
          <button type="button" onClick={() => settle(true)} className={primaryBtn()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}

export type PackFormProps = {
  subId: string;
  projectId: string;
  onSaved: () => void;
  /** True when a project admin / site manager is recording on the subcontractor's behalf. */
  onBehalf?: boolean;
};

export function AddLabour({ subId, projectId, onSaved, onBehalf = false }: PackFormProps) {
  const fn = useServerFn(addWorker);
  const dupeFn = useServerFn(checkWorkerDuplicate);
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [cardType, setCardType] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Worker name required");
      return;
    }
    const verify = window.confirm(
      `Please verify this labour entry:\n\n• Name: ${name.trim()}\n• Role: ${role.trim() || "—"}\n• Card: ${cardType.trim() || "—"} ${cardNumber.trim()}\n• Expiry: ${cardExpiry || "—"}\n• Competency Card File: ${file ? file.name : "none attached"}${onBehalf ? "\n\nThis will be stamped RECORDED BY SITE MANAGER." : ""}\n\nAdd to labour roster?`,
    );
    if (!verify) return;
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
      await fn({
        data: {
          subcontractorId: subId,
          name,
          role: role || null,
          competencyCardUrl: url,
          cardType: cardType || null,
          cardNumber: cardNumber || null,
          cardExpiry: cardExpiry || null,
          onBehalf,
        },
      });
      toast.success(`${name.trim()} added to labour roster`, {
        description: onBehalf ? "Recorded by site manager" : role.trim() ? `Role: ${role.trim()}` : undefined,
      });
      setName("");
      setRole("");
      setCardType("");
      setCardNumber("");
      setCardExpiry("");
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
        <Label text="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} />
        </Label>
        <Label text="Role">
          <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls()} placeholder="e.g. Electrician" />
        </Label>
        <Label text="Competency Card Type">
          <input value={cardType} onChange={(e) => setCardType(e.target.value)} className={inputCls()} placeholder="e.g. CSCS Gold / ECS / CPCS" />
        </Label>
        <Label text="Card Number">
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className={inputCls()} placeholder="e.g. 12345678" />
        </Label>
        <Label text="Card Expiry">
          <input type="date" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} className={inputCls()} />
        </Label>
        <Label text={`Competency Card File (PDF / Image · max ${MAX_UPLOAD_MB}MB)`} span="md:col-span-2">
          <input type="file" accept={FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={fileInputCls} />
          {file && <p className="mt-1 font-mono text-[0.65rem] text-foreground/50">{file.name}</p>}
          {busy && file && <ProgressBar pct={pct} />}
        </Label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Worker
      </button>
    </AccordionCard>
  );
}

export function AddRegister({ subId, projectId, onSaved, onBehalf = false }: PackFormProps) {
  const fn = useServerFn(addRegister);
  const dupeFn = useServerFn(checkRegisterDuplicate);
  const [type, setType] = useState<(typeof REGISTER_TYPE_OPTIONS)[number]>("PUWER");
  const [asset, setAsset] = useState("");
  const [date, setDate] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [inspector, setInspector] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const submit = async () => {
    const verify = window.confirm(
      `Please verify this register entry:\n\n• Type: ${type}\n• Asset: ${asset.trim() || "—"}\n• Inspection Date: ${date || "—"}\n• Next Due: ${nextDue || "—"}\n• Inspector: ${inspector.trim() || "—"}\n• Certificate: ${file ? file.name : "none attached"}${onBehalf ? "\n\nThis will be stamped RECORDED BY SITE MANAGER." : ""}\n\nAdd to ${type} register?`,
    );
    if (!verify) return;
    setBusy(true);
    setPct(0);
    try {
      if (file) {
        const dupe = await dupeFn({
          data: { subcontractorId: subId, type, assetName: asset || null, inspectionDate: date || null },
        });
        if (dupe.hasCert) {
          const parts = [type, asset || "asset", date || "same date"].join(" · ");
          const ok = window.confirm(`A certificate already exists for ${parts}. Upload another anyway?`);
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
          nextInspectionDue: nextDue || null,
          inspector: inspector || null,
          onBehalf,
        },
      });
      toast.success(`${asset.trim() || "Asset"} added to ${type} register`, {
        description: onBehalf
          ? "Recorded by site manager"
          : date
            ? `Inspection date: ${new Date(date).toLocaleDateString("en-GB")}`
            : undefined,
      });
      setAsset("");
      setDate("");
      setNextDue("");
      setInspector("");
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
        <Label text="Register Type">
          <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls()}>
            {REGISTER_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Label>
        <Label text="Equipment / Plant Item">
          <input value={asset} onChange={(e) => setAsset(e.target.value)} className={inputCls()} placeholder="e.g. 110V Transformer" />
        </Label>
        <Label text="Inspection Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls()} />
        </Label>
        <Label text="Next Inspection Due">
          <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={inputCls()} />
        </Label>
        <Label text="Inspector" span="md:col-span-2">
          <input value={inspector} onChange={(e) => setInspector(e.target.value)} className={inputCls()} placeholder="e.g. A. Jones (LOLER competent person)" />
        </Label>
        <Label text={`Certificate (PDF / Image · max ${MAX_UPLOAD_MB}MB)`} span="md:col-span-3">
          <input type="file" accept={FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={fileInputCls} />
          {file && <p className="mt-1 font-mono text-[0.65rem] text-foreground/50">{file.name}</p>}
          {busy && file && <ProgressBar pct={pct} />}
        </Label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Register
      </button>
    </AccordionCard>
  );
}

export function AddToolboxTalk({ subId, projectId, onSaved, onBehalf = false }: PackFormProps) {
  const fn = useServerFn(addToolboxTalk);
  const [topic, setTopic] = useState<(typeof TOOLBOX_TOPIC_OPTIONS)[number]>("Manual Handling");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [presenter, setPresenter] = useState("");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const submit = async () => {
    const list = attendees.split("\n").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      toast.error("Add at least one attendee");
      return;
    }
    const verify = window.confirm(
      `Please verify this toolbox talk:\n\n• Topic: ${topic}\n• Date: ${date || "—"}\n• Presenter: ${presenter.trim() || "—"}\n• Attendees (${list.length}): ${list.slice(0, 8).join(", ")}${list.length > 8 ? "…" : ""}${onBehalf ? "\n\nThis will be stamped RECORDED BY SITE MANAGER." : ""}\n\nLog this talk?`,
    );
    if (!verify) return;
    setBusy(true);
    setPct(0);
    try {
      let url: string | null = null;
      if (file) {
        try {
          url = await uploadCompliance(projectId, `toolbox/${subId}`, file, setPct);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Attachment upload failed", {
            description: "The talk was not saved. Try a smaller file or check your connection.",
          });
          setBusy(false);
          setPct(0);
          return;
        }
      }
      await fn({
        data: {
          subcontractorId: subId,
          topic,
          attendees: list,
          date: date || null,
          presenter: presenter || null,
          notes: notes || null,
          attachmentUrl: url,
          onBehalf,
        },
      });
      toast.success(`Toolbox talk logged: ${topic}`, {
        description: `${list.length} attendee${list.length === 1 ? "" : "s"} recorded${onBehalf ? " by site manager" : ""}`,
      });
      setAttendees("");
      setNotes("");
      setPresenter("");
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
    <AccordionCard icon={<ClipboardList size={18} />} eyebrow="03" title="Toolbox Talk">
      <div className="grid gap-3 md:grid-cols-3">
        <Label text="Topic">
          <select value={topic} onChange={(e) => setTopic(e.target.value as any)} className={inputCls()}>
            {TOOLBOX_TOPIC_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Label>
        <Label text="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls()} />
        </Label>
        <Label text="Presenter">
          <input value={presenter} onChange={(e) => setPresenter(e.target.value)} className={inputCls()} placeholder="e.g. J. Murphy" />
        </Label>
        <Label text="Attendees (one per line)" span="md:col-span-3">
          <textarea
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            rows={5}
            className={inputCls()}
            placeholder={"J. Smith\nR. Patel\nM. O'Neill"}
          />
        </Label>
        <Label text="Notes" span="md:col-span-3">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls()} placeholder="Key points covered, questions raised…" />
        </Label>
        <Label text={`Attachment (optional · max ${MAX_UPLOAD_MB}MB)`} span="md:col-span-3">
          <input type="file" accept={FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={fileInputCls} />
          {file && <p className="mt-1 font-mono text-[0.65rem] text-foreground/50">{file.name}</p>}
          {busy && file && <ProgressBar pct={pct} />}
        </Label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className={primaryBtn("mt-4")}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Save Talk
      </button>
    </AccordionCard>
  );
}

export function AddLookAhead({ subId, onSaved, onBehalf = false }: Omit<PackFormProps, "projectId"> & { projectId?: string }) {
  const fn = useServerFn(addLookAhead);
  const [plan, setPlan] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [highRisk, setHighRisk] = useState(false);
  const [permit, setPermit] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!plan.trim()) {
      toast.error("Work plan required");
      return;
    }
    const flags = [highRisk ? "HIGH RISK" : null, permit ? "PERMIT REQUIRED" : null].filter(Boolean).join(" · ") || "none";
    const preview = plan.trim().length > 180 ? plan.trim().slice(0, 180) + "…" : plan.trim();
    const verify = window.confirm(
      `Please verify this look-ahead:\n\n• Date: ${date || "—"}\n• Flags: ${flags}\n• Plan: ${preview}${onBehalf ? "\n\nThis will be stamped RECORDED BY SITE MANAGER." : ""}\n\nSave look-ahead?`,
    );
    if (!verify) return;
    setBusy(true);
    try {
      await fn({
        data: {
          subcontractorId: subId,
          workPlan: plan,
          isHighRisk: highRisk,
          permitRequired: permit,
          date: date || null,
          onBehalf,
        },
      });
      toast.success("Look-ahead added to work plan", {
        description: onBehalf ? "Recorded by site manager" : flags === "none" ? undefined : `Flags: ${flags}`,
      });
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
      <div className="grid gap-3 md:grid-cols-3">
        <Label text="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls()} />
        </Label>
        <Label text="Work Plan" span="md:col-span-3">
          <textarea
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            rows={5}
            className={inputCls()}
            placeholder="Detail the planned works for the coming week…"
          />
        </Label>
      </div>
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

export function PackFormStack({
  subId,
  projectId,
  onSaved,
  onBehalf = false,
}: PackFormProps) {
  return (
    <div className="space-y-4">
      <AddLabour subId={subId} projectId={projectId} onSaved={onSaved} onBehalf={onBehalf} />
      <AddRegister subId={subId} projectId={projectId} onSaved={onSaved} onBehalf={onBehalf} />
      <AddToolboxTalk subId={subId} projectId={projectId} onSaved={onSaved} onBehalf={onBehalf} />
      <AddLookAhead subId={subId} projectId={projectId} onSaved={onSaved} onBehalf={onBehalf} />
    </div>
  );
}
