import { useEffect, useRef, useState } from "react";
import { Copy, RotateCcw, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ToolingResults } from "./ToolingResults";

interface Props {
  output: string;
  isStreaming: boolean;
  activeFunction: string | null;
  onReset: () => void;
}

const STEPS = ["Reading input", "Analysing", "Generating", "Finalising"];

export const ToolingTerminal = ({ output, isStreaming, activeFunction, onReset }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      if (stepIdx > 0) {
        setStepIdx(STEPS.length - 1);
        const r = window.setTimeout(() => setStepIdx(0), 500);
        return () => clearTimeout(r);
      }
      return;
    }
    setStepIdx(0);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStepIdx((s) => Math.max(s, 1)), 900));
    timers.push(window.setTimeout(() => setStepIdx((s) => Math.max(s, 2)), 2400));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming && output) setStepIdx((s) => Math.max(s, 2));
  }, [isStreaming, output]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [output]);

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    toast.success("Copied");
  };

  return (
    <section className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl overflow-hidden flex flex-col min-h-[340px] shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-background/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-alert animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-primary/60" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
          </span>
          <Sparkles size={14} className="text-primary shrink-0" />
          <span className="font-display text-sm text-foreground truncate">The Oracle</span>
          {activeFunction && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-alert border border-alert/40 px-1.5 py-0.5 rounded-md truncate">
              {activeFunction}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {output && !isStreaming && (
            <>
              <Button variant="ghost" size="sm" onClick={copy} className="h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary">
                <Copy size={12} className="mr-1" /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs text-alert hover:bg-alert/10 hover:text-alert">
                <RotateCcw size={12} className="mr-1" /> Clear
              </Button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 max-h-[65vh]">
        {!output && !isStreaming && (
          <div className="text-sm">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              ▸ Ready · Awaiting Input
            </div>
            <p className="text-foreground font-display text-lg mb-2">Site manager, what's the call?</p>
            <p className="text-muted-foreground">
              Attach a drawing or photo, add any context, then choose an action below.
            </p>
          </div>
        )}

        {isStreaming && (
          <ol className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 mb-4">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">
              ▸ Progress
            </div>
            {STEPS.map((label, i) => {
              const done = i < stepIdx;
              const current = i === stepIdx;
              return (
                <li key={label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "h-5 w-5 rounded-md flex items-center justify-center border shrink-0 transition-all",
                      done && "bg-primary/20 border-primary text-primary",
                      current && "bg-alert/15 border-alert text-alert animate-pulse",
                      !done && !current && "bg-white/5 border-white/15 text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check size={12} strokeWidth={3} />
                    ) : current ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <span className="font-mono text-[10px]">{i + 1}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[12px] tracking-wide uppercase",
                      done && "text-primary/80",
                      current && "text-foreground",
                      !done && !current && "text-muted-foreground/70",
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {output && <ToolingResults markdown={output} />}
      </div>
    </section>
  );
};
