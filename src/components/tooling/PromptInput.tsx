import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PromptInput = ({ value, onChange, disabled }: Props) => {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 shadow-sm">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Optional site note (e.g. 'Soleplate datum on grid B/3 reads 12mm low')"
        className="bg-white border border-sky-200 focus-visible:ring-2 focus-visible:ring-[hsl(22_100%_54%)]/60 resize-none min-h-[64px] text-sm text-slate-900 placeholder:text-slate-500 p-3 rounded-xl"
      />
    </div>
  );
};
