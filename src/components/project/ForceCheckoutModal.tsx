import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { managerForceCheckout } from "@/lib/live-activity.functions";
import type { PinRecord } from "@/components/project/DrawingCanvas";

interface Props {
  pin: PinRecord;
  onClose: () => void;
  onDone: () => void;
}

export function ForceCheckoutModal({ pin, onClose, onDone }: Props) {
  const forceFn = useServerFn(managerForceCheckout);
  const [pct, setPct] = useState(50);
  const [notes, setNotes] = useState(
    "Automated manager checkout — crew left site without logging diary.",
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await forceFn({ data: { pinId: pin.id, completionPct: pct, notes } });
      toast.success("Crew force-checked out · diary archived");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-lg border-2 border-alert bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b-2 border-alert/40 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-alert" size={18} />
            <h3
              className="text-lg font-extrabold uppercase tracking-widest text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Force Checkout
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-white/15 p-1 text-foreground/60 hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <p className="mt-3 text-xs text-foreground/70">
          {pin.trade_package ?? "Untagged"} · {pin.operative_count} operatives.
          This archives the pin and creates a diary entry flagged as manager-forced.
        </p>

        <label className="mt-4 block">
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-alert">
            Estimated Completion · {pct}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="mt-2 w-full accent-alert"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-alert">
            Manager Note
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border-2 border-white/15 bg-black/40 p-2 text-xs text-foreground focus:border-alert focus:outline-none"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border-2 border-white/15 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/70 hover:border-white/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-md border-2 border-alert bg-alert px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-widest text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Closing…" : "Force Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
