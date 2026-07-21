import { useRef } from "react";
import { Camera, Upload, X, Eye } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface Props {
  imageDataUrl: string | null;
  onImage: (dataUrl: string | null, name: string | null) => void;
  fileName: string | null;
}

const RoundBtn = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex flex-col items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
  >
    <span
      className={cn(
        "h-14 w-14 sm:h-16 sm:w-16 rounded-full grid place-items-center",
        "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white",
        "shadow-[0_6px_20px_-6px_rgba(16,185,129,0.7)]",
        "ring-2 ring-white/70 ring-offset-2 ring-offset-card",
        "transition-transform group-hover:scale-105 group-active:scale-95",
      )}
    >
      {children}
    </span>
    <span className="font-mono text-[10px] tracking-widest text-foreground/80 uppercase">
      {label}
    </span>
  </button>
);

export const ScanUpload = ({ imageDataUrl, onImage, fileName }: Props) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImage(reader.result as string, file.name);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openViewer = () => {
    if (!imageDataUrl) return;
    sessionStorage.setItem("is-viewer-image", imageDataUrl);
    sessionStorage.setItem("is-viewer-name", fileName ?? "image");
    navigate({ to: "/viewer" });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm">
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
      <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />

      <div className="flex items-start justify-around gap-3 py-1">
        <RoundBtn label="Scan" onClick={() => cameraInputRef.current?.click()}>
          <Camera size={22} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn label="Upload" onClick={() => uploadInputRef.current?.click()}>
          <Upload size={22} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn label="View" onClick={openViewer} disabled={!imageDataUrl}>
          <Eye size={22} strokeWidth={2.2} />
        </RoundBtn>
      </div>

      {imageDataUrl && (
        <div className="flex items-center gap-2 min-w-0 rounded-lg p-2 bg-background border border-border">
          <button type="button" onClick={openViewer} className="shrink-0" aria-label="Open viewer">
            <img
              src={imageDataUrl}
              alt={fileName ?? "uploaded"}
              className="h-9 w-9 rounded-md object-cover border border-primary/40"
            />
          </button>
          <span className="text-xs text-foreground/80 truncate flex-1">{fileName}</span>
          <button
            type="button"
            onClick={() => onImage(null, null)}
            className="text-muted-foreground hover:text-alert p-1 rounded-md hover:bg-alert/10"
            aria-label="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
