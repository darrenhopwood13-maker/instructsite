import { useRef } from "react";
import { Camera, Upload, X, ImageIcon, Eye } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface Props {
  imageDataUrl: string | null;
  onImage: (dataUrl: string | null, name: string | null) => void;
  fileName: string | null;
}

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

  const btn =
    "group relative flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Capture · Input
        </span>
        {imageDataUrl && (
          <span className="font-mono text-[10px] tracking-widest text-alert uppercase">● Active</span>
        )}
      </div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
      <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className={cn(btn, "bg-alert text-alert-foreground border-alert hover:bg-alert/90")}
        >
          <Camera size={16} strokeWidth={2.4} />
          Scan
        </button>
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className={cn(btn, "bg-transparent text-primary border-primary/60 hover:bg-primary/10")}
        >
          <Upload size={16} strokeWidth={2.4} />
          Upload
        </button>
        <button
          type="button"
          onClick={openViewer}
          disabled={!imageDataUrl}
          className={cn(
            btn,
            "bg-transparent border-white/20 text-foreground hover:bg-white/5",
            !imageDataUrl && "opacity-40 cursor-not-allowed",
          )}
        >
          <Eye size={16} strokeWidth={2.4} />
          View
        </button>
      </div>

      {imageDataUrl ? (
        <div className="flex items-center gap-2 min-w-0 rounded-lg p-2 bg-white/5 border border-white/10">
          <button type="button" onClick={openViewer} className="shrink-0" aria-label="Open viewer">
            <img
              src={imageDataUrl}
              alt={fileName ?? "uploaded"}
              className="h-10 w-10 rounded-lg object-cover border border-primary/40 hover:border-primary transition-all"
            />
          </button>
          <span className="text-xs text-muted-foreground truncate flex-1">{fileName}</span>
          <button
            type="button"
            onClick={() => onImage(null, null)}
            className="text-muted-foreground hover:text-alert p-1 rounded-md hover:bg-alert/10"
            aria-label="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-mono">
          <ImageIcon size={11} /> No photo attached
        </span>
      )}
    </div>
  );
};
