import { FileText, Image as ImageIcon, FileArchive, Eye } from "lucide-react";
import type { BibleDocument } from "@/lib/project-bible.functions";

function formatSize(n: number | null) {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return "";
  }
}

export function DocumentCard({
  doc,
  onView,
}: {
  doc: BibleDocument;
  onView: () => void;
}) {
  const mime = (doc.mimeType ?? "").toLowerCase();
  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");
  const Icon = isImage ? ImageIcon : isPdf ? FileText : FileArchive;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card/60 shadow-sm transition hover:border-border hover:shadow-md">
      <button
        type="button"
        onClick={onView}
        className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/40"
        aria-label={`Preview ${doc.title}`}
      >
        <Icon className="h-14 w-14 text-muted-foreground/60 transition group-hover:text-primary/70" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-background/80 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/80 opacity-0 backdrop-blur transition group-hover:opacity-100">
          <Eye className="h-3 w-3" /> View
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 border-t border-border/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {doc.category}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(doc.uploadedAt)}
          </span>
        </div>
        <h3
          className="line-clamp-2 text-sm font-semibold text-foreground"
          title={doc.title}
        >
          {doc.title}
        </h3>
        <p
          className="line-clamp-1 text-xs text-muted-foreground"
          title={doc.fileName}
        >
          {doc.fileName}
          {formatSize(doc.sizeBytes) && ` · ${formatSize(doc.sizeBytes)}`}
        </p>
        <button
          type="button"
          onClick={onView}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground/80 transition hover:border-primary/60 hover:text-primary"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
      </div>
    </article>
  );
}
