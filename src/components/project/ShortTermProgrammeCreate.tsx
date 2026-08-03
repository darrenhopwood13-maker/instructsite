import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  createShortTermProgrammeFromBuilder,
  createShortTermProgrammeFromUpload,
} from "@/lib/short-term-programme.functions";
import { ActivityPicker } from "@/components/project/ActivityPicker";
import { isoDay } from "@/lib/short-term-programme";

export type StpTarget = {
  inviteId: string;
  companyName: string;
  packageLabel: string;
  acceptedCount: number;
  remaining: number;
  hasPmSeat: boolean;
  pmName: string | null;
};

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * "Does this subcontractor already have a programme for this work?"
 *  Yes -> upload path (reuses the programme compiler).
 *  No  -> AI Builder from described activities.
 */
export function ShortTermProgrammeCreate({
  projectId,
  targets,
  cap,
  onClose,
  onCreated,
}: {
  projectId: string;
  targets: StpTarget[];
  cap: number;
  onClose: () => void;
  onCreated: (programmeId: string) => void;
}) {
  const uploadFn = useServerFn(createShortTermProgrammeFromUpload);
  const builderFn = useServerFn(createShortTermProgrammeFromBuilder);

  const [targetKey, setTargetKey] = useState(
    targets[0] ? `${targets[0].inviteId}|${targets[0].packageLabel}` : "",
  );
  const [mode, setMode] = useState<"ask" | "upload" | "builder">("ask");
  const [title, setTitle] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(isoDay(new Date()));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const target = targets.find((t) => `${t.inviteId}|${t.packageLabel}` === targetKey) ?? null;
  const capReached = !!target && target.remaining === 0;

  const base = () => ({
    projectId,
    packageInviteId: target!.inviteId,
    packageLabel: target!.packageLabel,
    title: title.trim() || `${target!.packageLabel} short-term programme`,
  });

  const submitUpload = async () => {
    if (!target || !file) return;
    setBusy(true);
    try {
      const res = await uploadFn({
        data: {
          ...base(),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64: await toBase64(file),
        },
      });
      toast.success(`Draft created from ${file.name} · ${res.taskCount} tasks.`);
      onCreated(res.programmeId);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not read that programme file.");
    } finally {
      setBusy(false);
    }
  };

  const submitBuilder = async () => {
    if (!target || activities.length === 0) return;
    setBusy(true);
    try {
      const res = await builderFn({ data: { ...base(), activities, startDate } });
      toast.success(
        res.source === "ai"
          ? `Draft programme built · ${res.taskCount} tasks. Tune the dates before sending it.`
          : `Draft created with ${res.taskCount} tasks. Tune the dates before sending it.`,
      );
      onCreated(res.programmeId);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not build the programme.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur">
      <div className="glass-panel relative my-6 w-full max-w-2xl p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm border border-white/15 p-1.5 text-foreground/60 hover:text-foreground"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
          Short-Term Programme
        </p>
        <h3 className="mt-1 text-xl font-extrabold uppercase tracking-tight text-foreground">
          New programme
        </h3>

        <label className="mt-4 block">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Subcontractor · Package
          </span>
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-alert"
          >
            {targets.length === 0 && <option value="">No subcontractor packages yet</option>}
            {targets.map((t) => (
              <option key={`${t.inviteId}|${t.packageLabel}`} value={`${t.inviteId}|${t.packageLabel}`}>
                {t.companyName} · {t.packageLabel} · {t.acceptedCount}/{cap} accepted
              </option>
            ))}
          </select>
        </label>

        {target && (
          <p
            className={`mt-1.5 text-[0.6rem] uppercase tracking-widest ${
              capReached ? "text-red-400" : "text-foreground/50"
            }`}
          >
            {capReached
              ? `Cap reached — ${target.companyName} already has ${cap} accepted programmes for ${target.packageLabel}.`
              : `${target.remaining} of ${cap} accepted programmes remaining for this package.`}
            {!target.hasPmSeat &&
              " · No subcontractor PM seat accepted yet — they will not be able to counter-sign."}
          </p>
        )}

        <label className="mt-4 block">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={target ? `${target.packageLabel} short-term programme` : "Programme title"}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-alert"
          />
        </label>

        {mode === "ask" && (
          <div className="mt-5">
            <p className="text-sm text-foreground/80">
              Does this subcontractor already have a programme for this work?
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("upload")}
                disabled={!target || capReached}
                className="btn-secondary flex items-center justify-center gap-2 px-4 py-3 text-xs disabled:opacity-40"
              >
                <Upload size={13} /> Yes — upload it
              </button>
              <button
                type="button"
                onClick={() => setMode("builder")}
                disabled={!target || capReached}
                className="btn-primary flex items-center justify-center gap-2 px-4 py-3 text-xs disabled:opacity-40"
              >
                <Bot size={13} /> No — build one
              </button>
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div className="mt-5 space-y-3">
            <input
              type="file"
              accept=".pdf,.csv,.tsv,.txt,.xml,.xer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-xs text-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-alert file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
            />
            <p className="text-[0.6rem] uppercase tracking-widest text-foreground/40">
              CSV, XML, XER or a text-based PDF. Parsed into this programme only — the master
              baseline is untouched.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("ask")} className="btn-secondary px-4 py-2 text-xs">
                Back
              </button>
              <button
                type="button"
                onClick={() => void submitUpload()}
                disabled={busy || !file}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Create draft
              </button>
            </div>
          </div>
        )}

        {mode === "builder" && (
          <div className="mt-5 space-y-3">
            <ActivityPicker projectId={projectId} selected={activities} onChange={setActivities} />
            <label className="block">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
                Start date
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Array.from({ length: 10 }, (_, i) =>
                  new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10),
                ).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setStartDate(d)}
                    className={`rounded-sm border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-widest ${
                      startDate === d
                        ? "border-alert bg-alert/20 text-alert"
                        : "border-white/15 text-foreground/60"
                    }`}
                  >
                    {d.slice(5)}
                  </button>
                ))}
              </div>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("ask")} className="btn-secondary px-4 py-2 text-xs">
                Back
              </button>
              <button
                type="button"
                onClick={() => void submitBuilder()}
                disabled={busy || activities.length === 0}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                Build draft programme
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
