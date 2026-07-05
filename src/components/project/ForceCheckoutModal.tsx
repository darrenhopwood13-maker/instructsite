import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { managerForceCheckout } from "@/lib/manager-checkout.functions";

export function ForceCheckoutModal({
  pinId,
  projectId,
  tradeLabel,
  onClose,
}: {
  pinId: string;
  projectId: string;
  tradeLabel?: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const forceFn = useServerFn(managerForceCheckout);
  const [pct, setPct] = useState(50);
  const [notes, setNotes] = useState("Automated manager checkout — crew left site.");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await forceFn({ data: { pinId, completionPct: pct, notes } });
      toast.success("Shift force-closed", {
        description: "Diary entry recorded. Pin cleared from live map.",
      });
      qc.invalidateQueries({ queryKey: ["live-pins", projectId] });
      qc.invalidateQueries({ queryKey: ["qs-queue", projectId] });
      qc.invalidateQueries({ queryKey: ["archived-today", projectId] });
      onClose();
    } catch (e: any) {
      toast.error("Force checkout failed", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-alert">
              Force Checkout
            </p>
            <h3 className="mt-1 text-lg font-semibold text-card-foreground">
              {tradeLabel ?? "Crew"} · Manager Override
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Records a daily diary on the crew's behalf and archives the live pin. Flagged as
          <span className="font-semibold text-foreground"> manager_force_closed</span>.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Estimated completion · {pct}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </label>

          <label className="block">
            <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Manager note
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Closing…" : "Force Checkout & Close Diary"}
          </button>
        </div>
      </div>
    </div>
  );
}
