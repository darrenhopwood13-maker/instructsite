import { useRef } from "react";
import { Camera, Upload, Eye } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  imageDataUrl: string | null;
  pdfBase64: string | null;
  onImage: (dataUrl: string | null, name: string | null) => void;
  onPdf: (base64: string | null, name: string | null) => void;
  fileName: string | null;
}

const MAX_PDF_BYTES = 15 * 1024 * 1024;

const OrangeBtn = ({
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
        "relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl grid place-items-center",
        "bg-gradient-to-br from-[hsl(28_100%_62%)] via-[hsl(22_100%_54%)] to-[hsl(18_100%_46%)]",
        "text-white",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_6px_rgba(120,40,0,0.45),0_8px_20px_-6px_rgba(255,110,0,0.55),0_2px_4px_rgba(0,0,0,0.25)]",
        "ring-1 ring-white/10",
        "transition-all duration-200",
        "hover:ring-2 hover:ring-white/80 hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-[inset_0_2px_6px_rgba(120,40,0,0.6)]",
        "before:absolute before:inset-x-1.5 before:top-1 before:h-1/3 before:rounded-t-xl",
        "before:bg-gradient-to-b before:from-white/45 before:to-transparent before:pointer-events-none",
      )}
    >
      {children}
    </span>
    <span className="font-mono text-[10px] tracking-widest text-slate-700 uppercase">
      {label}
    </span>
  </button>
);

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
};

export const ScanUpload = ({ imageDataUrl, pdfBase64, onImage, onPdf, fileName }: Props) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = async (file: File) => {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      if (file.size > MAX_PDF_BYTES) {
        toast.error("PDF too large", { description: "Max 15 MB. Export a smaller PDF or attach fewer pages." });
        return;
      }
      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      onImage(null, null);
      onPdf(base64, file.name);
      return;
    }
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        onPdf(null, null);
        onImage(reader.result as string, file.name);
      };
      reader.readAsDataURL(file);
      return;
    }
    toast.error("Unsupported file", { description: "Attach an image (JPG/PNG) or a PDF." });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  };

  const openViewer = () => {
    if (imageDataUrl) {
      sessionStorage.setItem("is-viewer-kind", "image");
      sessionStorage.setItem("is-viewer-image", imageDataUrl);
      sessionStorage.setItem("is-viewer-name", fileName ?? "image");
      navigate({ to: "/viewer" });
      return;
    }
    if (pdfBase64) {
      sessionStorage.setItem("is-viewer-kind", "pdf");
      sessionStorage.setItem("is-viewer-pdf", pdfBase64);
      sessionStorage.setItem("is-viewer-name", fileName ?? "document.pdf");
      navigate({ to: "/viewer" });
    }
  };

  const hasAttachment = !!imageDataUrl || !!pdfBase64;

  return (
    <div className="flex items-start justify-around gap-3 py-1">
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
      <input ref={uploadInputRef} type="file" accept="application/pdf,image/*,.heic,.heif,.txt,.csv,.tsv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.rvt,.ifc,.xml,.json" className="hidden" onChange={onChange} />

      <OrangeBtn label="Scan" onClick={() => cameraInputRef.current?.click()}>
        <Camera size={22} strokeWidth={2.2} />
      </OrangeBtn>
      <OrangeBtn label="Upload" onClick={() => uploadInputRef.current?.click()}>
        <Upload size={22} strokeWidth={2.2} />
      </OrangeBtn>
      <OrangeBtn label="View" onClick={openViewer} disabled={!hasAttachment}>
        <Eye size={22} strokeWidth={2.2} />
      </OrangeBtn>
    </div>
  );
};
