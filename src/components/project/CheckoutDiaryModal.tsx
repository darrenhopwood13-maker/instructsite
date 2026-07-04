import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { X, Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitDailyDiary } from "@/lib/daily-diary.functions";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

type ProgressStatus = "completed" | "partial" | "not_completed";

interface Props {
  pin: {
    id: string;
    project_id: string;
    trade_package: string | null;
    operative_count: number;
    start_time: string;
  };
  onClose: () => void;
}

export function CheckoutDiaryModal({ pin, onClose }: Props) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitDailyDiary);
  const [progress, setProgress] = useState<ProgressStatus>("completed");
  const [pct, setPct] = useState<number>(100);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ path: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    if (photos.length + list.length > 20) {
      toast.error("Max 20 photos per diary.");
      return;
    }
    setUploading(true);
    try {
      const uploaded: { path: string; name: string }[] = [];
      for (const f of list) {
        if (!f.type.startsWith("image/")) continue;
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${pin.project_id}/${pin.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("diary-photos")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        uploaded.push({ path, name: f.name });
      }
      setPhotos((p) => [...p, ...uploaded]);
    } catch (err: any) {
      toast.error(err?.message ?? "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (path: string) => {
    await supabase.storage.from("diary-photos").remove([path]);
    setPhotos((p) => p.filter((x) => x.path !== path));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitFn({
        data: {
          liveActivityId: pin.id,
          progressStatus: progress,
          completionPct: pct,
          notes: notes.trim() || undefined,
          photoUrls: photos.map((p) => p.path),
        },
      });
      toast.success("Daily diary submitted · shift closed out.");
      qc.invalidateQueries({ queryKey: ["live-pins", pin.project_id] });
      qc.invalidateQueries({ queryKey: ["qs-queue", pin.project_id] });
      qc.invalidateQueries({ queryKey: ["archived-today", pin.project_id] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit diary.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur">
      <form
        onSubmit={submit}
        className="glass-panel w-full max-w-lg max-h-[92vh] overflow-y-auto border-2 border-alert p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
              End-of-Shift Diary
            </p>
            <h3
              className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Close Out Shift
            </h3>
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
              {pin.trade_package ?? "Crew"} · {pin.operative_count} ops
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-white/15 p-1.5 text-foreground/60 hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {/* Progress Status */}
        <fieldset className="mt-5">
          <legend className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Task Progress Status *
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["completed", "Completed"],
                ["partial", "Partial"],
                ["not_completed", "Not Done"],
              ] as [ProgressStatus, string][]
            ).map(([val, label]) => (
              <label
                key={val}
                className={`cursor-pointer rounded-md border-2 px-2 py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest transition ${
                  progress === val
                    ? "border-alert bg-alert/20 text-alert"
                    : "border-white/15 text-foreground/60 hover:border-white/40"
                }`}
              >
                <input
                  type="radio"
                  name="progress"
                  value={val}
                  checked={progress === val}
                  onChange={() => setProgress(val)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Completion % */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Estimated Zone Completion
            </span>
            <span className="font-mono text-lg font-bold text-alert">{pct}%</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Slider
              value={[pct]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setPct(v[0] ?? 0)}
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={pct}
              onChange={(e) =>
                setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
              }
              className="w-16 rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-center font-mono text-sm text-foreground outline-none focus:border-alert"
            />
          </div>
        </div>

        {/* Photo Evidence */}
        <div className="mt-5">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
            Upload Progress Verification Photos
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
            }}
            className="mt-2 grid grid-cols-2 gap-2"
          >
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-white/20 bg-black/30 px-3 py-4 text-[0.6rem] uppercase tracking-widest text-foreground/60 hover:border-alert hover:text-alert disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Camera size={20} />
              )}
              <span className="mt-1">Camera / Files</span>
            </button>
            <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-white/20 bg-black/30 px-3 py-4 text-[0.6rem] uppercase tracking-widest text-foreground/50">
              <Upload size={20} />
              <span className="mt-1">or drop images</span>
            </div>
          </div>
          {photos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {photos.map((p) => (
                <li
                  key={p.path}
                  className="flex items-center justify-between gap-2 rounded-sm border border-white/10 bg-black/30 px-2 py-1 text-[0.65rem] text-foreground/70"
                >
                  <span className="truncate font-mono">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(p.path)}
                    className="text-foreground/50 hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notes */}
        <div className="mt-5">
          <label className="block">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Log Site Notes, Delays, or Variances
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="e.g. Delayed 2 hours waiting for primary contractor materials delivery."
              className="mt-1 border-white/15 bg-black/40 font-mono text-xs text-foreground focus-visible:ring-alert"
            />
          </label>
          <p className="mt-1 text-right font-mono text-[0.55rem] uppercase tracking-widest text-foreground/40">
            {notes.length}/2000
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-white/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="glass-orange shimmer-btn rounded-md px-5 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit Daily Diary"}
          </button>
        </div>
      </form>
    </div>
  );
}
