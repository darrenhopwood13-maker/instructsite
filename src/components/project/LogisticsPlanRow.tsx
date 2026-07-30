import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { retryLogisticsExtraction } from "@/lib/tier1-uploads.functions";
import { errorMessage } from "@/lib/error-message";

const PILL: Record<string, string> = {
  pending: "border-white/20 text-foreground/60",
  processing: "border-alert/50 text-alert",
  complete: "border-emerald-400/50 text-emerald-400",
  empty: "border-white/20 text-foreground/50",
  failed: "border-destructive/60 text-destructive-foreground",
};

export function LogisticsPlanRow({
  plan,
  onChanged,
}: {
  plan: any;
  onChanged?: () => void;
}) {
  const retryFn = useServerFn(retryLogisticsExtraction);
  const [busy, setBusy] = useState(false);
  const status: string = plan.extraction_status ?? "pending";
  const zoneCount = Array.isArray(plan.extracted_zones) ? plan.extracted_zones.length : 0;

  const run = async (label: string) => {
    setBusy(true);
    try {
      const res = await retryFn({ data: { logisticsPlanId: plan.id } });
      if (res.status === "empty") {
        toast.warning("No labelled work zones could be read from this plan.");
      } else {
        toast.success(
          `${label}: ${res.zonesExtracted} zone${res.zonesExtracted === 1 ? "" : "s"} extracted · ${res.zonesLinked} linked to this plan.`,
        );
      }
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e, "Extraction failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-white/8 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-foreground/85">
          {plan.site_documents?.file_name}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest ${PILL[status] ?? PILL.pending}`}
          >
            {status}
          </span>
          {(status === "processing" || status === "failed" || status === "empty") && (
            <button
              type="button"
              onClick={() => run("Re-extracted")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-sm border border-alert bg-alert/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-alert hover:bg-alert/30 disabled:opacity-40"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Retry extraction
            </button>
          )}
          {status === "complete" && (
            <button
              type="button"
              onClick={() => run("Zones re-extracted")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-sm border border-white/20 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/80 hover:border-alert hover:text-alert disabled:opacity-40"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
              Re-extract zones
            </button>
          )}
        </div>
      </div>
      {zoneCount > 0 && (
        <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
          {zoneCount} zone{zoneCount === 1 ? "" : "s"} extracted
        </p>
      )}
      {plan.extraction_error && (
        <p className="mt-1 text-[0.65rem] text-destructive-foreground/80">{plan.extraction_error}</p>
      )}
    </div>
  );
}
