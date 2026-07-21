import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, name: string) => void;
}

export const CaptureCameraDialog = ({ open, onClose, onCapture }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        toast.error("Camera unavailable. Check browser permissions.");
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      setReady(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onClose]);

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onCapture(dataUrl, `capture-${Date.now()}.jpg`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera size={18} className="text-primary" /> Live capture
          </DialogTitle>
        </DialogHeader>
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
              <RefreshCw className="animate-spin" size={20} />
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            <X size={14} className="mr-1.5" /> Cancel
          </Button>
          <Button onClick={snap} disabled={!ready}>
            <Camera size={14} className="mr-1.5" /> Capture
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
