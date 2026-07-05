import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { issuePinPermit } from "@/lib/live-activity.functions";
import type { PinRecord } from "@/components/project/DrawingCanvas";

interface Props {
  pin: PinRecord & { project_id?: string };
  projectId: string;
  onClose: () => void;
}

export function PermitSignOffModal({ pin, projectId, onClose }: Props) {
  const qc = useQueryClient();
  const issueFn = useServerFn(issuePinPermit);
  const [validHours, setValidHours] = useState(8);
  const [ack, setAck] = useState({ site: false, ppe: false, rescue: false });
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);

  const allAcked = ack.site && ack.ppe && ack.rescue && signature.trim().length > 1;

  const submit = async () => {
    if (!allAcked) return;
    setBusy(true);
    try {
      await issueFn({ data: { pinId: pin.id, validHours } });
      toast.success("Permit issued · pin reverted to operational tracking.");
      qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to issue permit.");
    } finally {
      setBusy(false);
    }
  };

  const flags = pin.high_risk_flags ?? [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur">
      <div className="glass-panel relative w-full max-w-lg max-h-[92vh] overflow-y-auto border-2 border-amber-400 p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm border border-white/15 p-1.5 text-foreground/60 hover:text-foreground"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-400 text-black">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-amber-400">
              Permit to Work
            </p>
            <h3
              className="text-xl font-extrabold uppercase tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              High-Risk Sign-Off
            </h3>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-amber-400/50 bg-amber-400/10 p-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-amber-300">
            Task
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {pin.trade_package ?? "Untagged crew"} · {pin.operative_count ?? 0} operatives
          </p>
          {pin.notes && (
            <p className="mt-2 text-xs text-foreground/80">{pin.notes}</p>
          )}
          {flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {flags.map((f) => (
                <span
                  key={f}
                  className="rounded-sm border border-amber-400 bg-black/30 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-amber-300"
                >
                  {f.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2.5">
          {[
            ["site", "Site conditions inspected · exclusion zone in place"],
            ["ppe", "All operatives briefed · correct PPE confirmed on site"],
            ["rescue", "Rescue plan / fire watch / spotter in place for shift duration"],
          ].map(([k, label]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-xs ${
                ack[k as keyof typeof ack]
                  ? "border-amber-400 bg-amber-400/10 text-foreground"
                  : "border-white/15 text-foreground/70"
              }`}
            >
              <input
                type="checkbox"
                checked={ack[k as keyof typeof ack]}
                onChange={(e) =>
                  setAck((p) => ({ ...p, [k]: e.target.checked }))
                }
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Valid Hours
            </span>
            <input
              type="number"
              min={1}
              max={24}
              value={validHours}
              onChange={(e) => setValidHours(Math.max(1, Math.min(24, Number(e.target.value) || 8)))}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-amber-400"
            />
          </label>
          <label className="block">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-foreground/60">
              Manager Signature
            </span>
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Print your name"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-amber-400"
            />
          </label>
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
            type="button"
            onClick={submit}
            disabled={!allAcked || busy}
            className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-5 py-2 text-xs font-extrabold uppercase tracking-widest text-black shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
            Approve Permit
          </button>
        </div>
      </div>
    </div>
  );
}
