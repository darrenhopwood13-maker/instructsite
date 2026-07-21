import { useRef, useState } from "react";
import { Camera, Upload, X, ImageIcon, Eye, Aperture } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CaptureCameraDialog } from "./CaptureCameraDialog";

interface Props {
  imageDataUrl: string | null;
  onImage: (dataUrl: string | null, name: string | null) => void;
  fileName: string | null;
}

export const ScanUpload = ({ imageDataUrl, onImage, fileName }: Props) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [captureOpen, setCaptureOpen] = useState(false);

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
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 flex flex-col gap-3 shadow-sm">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button type="button" onClick={() => setCaptureOpen(true)} className="w-full">
          <Aperture size={16} className="mr-1.5" /> Capture
        </Button>
        <Button type="button" variant="secondary" onClick={() => cameraInputRef.current?.click()} className="w-full">
          <Camera size={16} className="mr-1.5" /> Scan
        </Button>
        <Button type="button" variant="secondary" onClick={() => uploadInputRef.current?.click()} className="w-full">
          <Upload size={16} className="mr-1.5" /> Upload
        </Button>
        <Button type="button" variant="outline" onClick={openViewer} disabled={!imageDataUrl} className="w-full">
          <Eye size={16} className="mr-1.5" /> View
        </Button>
      </div>

      {imageDataUrl ? (
        <div className="flex items-center gap-2 min-w-0 rounded-lg p-2 bg-background border border-border">
          <button type="button" onClick={openViewer} className="shrink-0" aria-label="Open viewer">
            <img
              src={imageDataUrl}
              alt={fileName ?? "uploaded"}
              className="h-10 w-10 rounded-lg object-cover border border-primary/40 hover:border-primary transition-all"
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
      ) : (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-mono">
          <ImageIcon size={11} /> No photo attached
        </span>
      )}

      <CaptureCameraDialog
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={(dataUrl, name) => onImage(dataUrl, name)}
      />
    </div>
  );
};
