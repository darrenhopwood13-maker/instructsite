import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PromptInput = ({ value, onChange, disabled }: Props) => {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 flex flex-col gap-2 shadow-sm">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Prompt · Context
      </span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Add any context — grid refs, trade, spec notes, question…"
        className="bg-background border border-border focus-visible:ring-2 focus-visible:ring-primary/60 resize-none min-h-[84px] text-sm text-foreground placeholder:text-muted-foreground/70 p-3 rounded-lg"
      />
    </div>
  );
};
