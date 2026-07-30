import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PromptInput = ({ value, onChange, disabled }: Props) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-xl p-3 shadow-lg">
      <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 px-0.5">
        ▸ Site note (optional)
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Optional site note (e.g. 'Soleplate datum on grid B/3 reads 12mm low')"
        className="bg-black/40 border border-white/10 focus-visible:ring-2 focus-visible:ring-[hsl(22_100%_54%)]/60 focus-visible:border-[hsl(22_100%_54%)]/50 resize-none min-h-[64px] text-sm text-foreground placeholder:text-muted-foreground/70 p-3 rounded-xl"
      />
    </div>
  );
};
