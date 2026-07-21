import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PromptInput = ({ value, onChange, disabled }: Props) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Optional site note (e.g. 'Soleplate datum on grid B/3 reads 12mm low')"
        className="bg-background border border-border focus-visible:ring-2 focus-visible:ring-primary/60 resize-none min-h-[64px] text-sm text-foreground placeholder:text-muted-foreground/70 p-3 rounded-xl"
      />
    </div>
  );
};
