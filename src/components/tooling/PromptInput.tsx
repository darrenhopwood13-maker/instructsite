import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PromptInput = ({ value, onChange, disabled }: Props) => {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Prompt · Context
      </span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Add any context — grid refs, trade, spec notes, question…"
        className="bg-transparent border-0 focus-visible:ring-0 resize-none min-h-[72px] text-sm text-foreground placeholder:text-muted-foreground/70 p-0"
      />
    </div>
  );
};
