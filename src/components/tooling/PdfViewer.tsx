import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PdfViewer({ bytes, name }: { bytes: Uint8Array; name: string }) {
  const navigate = useNavigate();
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);

  const file = useMemo(() => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }, [bytes]);

  useEffect(() => () => URL.revokeObjectURL(file), [file]);

  const download = () => {
    const a = document.createElement("a");
    a.href = file;
    a.download = name.endsWith(".pdf") ? name : `${name}.pdf`;
    a.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-white/10 bg-white/[0.03] backdrop-blur px-3 py-2 flex items-center gap-2 z-20">
        <button
          onClick={() => navigate({ to: "/tooling" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-primary border border-primary/40 hover:bg-primary/10"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase truncate flex-1">
          ▸ PDF · {name}
        </span>
        <button onClick={download} title="Download" className="p-2 rounded-lg text-primary border border-primary/40 hover:bg-primary/10">
          <Download size={14} />
        </button>
      </header>

      <div className="flex-1 overflow-auto flex justify-center bg-neutral-900/40 p-3">
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={(err) => toast.error("PDF failed to load", { description: err.message })}
          loading={<div className="text-muted-foreground text-sm p-6">Loading PDF…</div>}
        >
          <Page pageNumber={page} scale={scale} renderAnnotationLayer renderTextLayer className="shadow-2xl" />
        </Document>
      </div>

      <div className="border-t border-white/10 bg-white/[0.03] backdrop-blur px-3 py-2 flex items-center gap-2 flex-wrap z-20">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="font-mono text-[11px] text-muted-foreground w-20 text-center">
          {page} / {numPages || "…"}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(numPages || p, p + 1))}
          disabled={numPages > 0 && page >= numPages}
          className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
        <span className="h-6 w-px bg-white/15 mx-1" />
        <button onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10">
          <ZoomOut size={14} />
        </button>
        <span className="font-mono text-[11px] text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(4, s + 0.2))} className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setScale(1)} className="p-2 rounded-lg border border-white/15 text-primary hover:bg-primary/10">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
