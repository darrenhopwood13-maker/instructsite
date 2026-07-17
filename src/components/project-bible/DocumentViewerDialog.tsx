import { useEffect, useState } from "react";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getBibleDocumentSignedUrl } from "@/lib/project-bible.functions";
import type { BibleDocument } from "@/lib/project-bible.functions";

type Props = {
  doc: BibleDocument;
  projectId: string;
  onClose: () => void;
};

export function DocumentViewerDialog({ doc, projectId, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const getUrl = useServerFn(getBibleDocumentSignedUrl);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setErr(null);
    getUrl({
      data: { projectId, bucket: doc.bucket, filePath: doc.filePath },
    })
      .then((r) => {
        if (!alive) return;
        if (!r.signedUrl) setErr("Could not generate a preview link.");
        else setUrl(r.signedUrl);
      })
      .catch((e) => alive && setErr(e?.message ?? "Failed to load document."));
    return () => {
      alive = false;
    };
  }, [doc, projectId, getUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isPdf = (doc.mimeType ?? "").toLowerCase().includes("pdf");
  const isImage = (doc.mimeType ?? "").toLowerCase().startsWith("image/");

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/70 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {doc.title}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {doc.category} · {doc.fileName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs uppercase tracking-widest text-foreground/80 hover:border-border hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
              <a
                href={url}
                download={doc.fileName}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs uppercase tracking-widest text-foreground/80 hover:border-border hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/60 text-foreground/80 hover:border-border hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-black/40">
        {!url && !err && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
          </div>
        )}
        {err && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
            {err}
          </div>
        )}
        {url && isPdf && (
          <iframe
            title={doc.title}
            src={url}
            className="h-full w-full border-0 bg-white"
          />
        )}
        {url && isImage && (
          <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
            <img
              src={url}
              alt={doc.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        {url && !isPdf && !isImage && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>This file type can't be previewed inline.</p>
            <a
              href={url}
              download={doc.fileName}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs uppercase tracking-widest text-foreground/80 hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Download {doc.fileName}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
