import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Image as ImageIcon,
  FileArchive,
  Eye,
  Archive,
  RotateCcw,
  Boxes,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";
import {
  getBibleDocumentSignedUrl,
  type BibleDocument,
} from "@/lib/project-bible.functions";

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

// Icon + colour tuned to the file type, so the deck reads at a glance
// instead of being a wall of identical grey placeholders.
function iconForDoc(doc: BibleDocument) {
  const mime = (doc.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return { Icon: ImageIcon, color: "text-sky-300" };
  if (mime.includes("pdf")) return { Icon: FileText, color: "text-rose-300" };
  if (doc.source === "model") return { Icon: Boxes, color: "text-emerald-300" };
  if (doc.source === "programme") return { Icon: CalendarDays, color: "text-amber-300" };
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return { Icon: FileSpreadsheet, color: "text-lime-300" };
  return { Icon: FileArchive, color: "text-foreground/60" };
}

export function DocumentCard({
  doc,
  projectId,
  onView,
  onArchive,
  onRestore,
  canArchive,
}: {
  doc: BibleDocument;
  projectId: string;
  onView: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  canArchive?: boolean;
}) {
  const { Icon, color } = iconForDoc(doc);
  const isImage = (doc.mimeType ?? "").toLowerCase().startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const getUrl = useServerFn(getBibleDocumentSignedUrl);

  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    const fetchUrl = () => {
      getUrl({ data: { projectId, bucket: doc.bucket, filePath: doc.filePath } })
        .then((r) => alive && setThumb(r.signedUrl ?? null))
        .catch(() => {});
    };
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      fetchUrl();
      return () => {
        alive = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            fetchUrl();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [isImage, doc.bucket, doc.filePath, projectId, getUrl]);

  const canLifecycle =
    canArchive &&
    (doc.source === "drawing" ||
      doc.source === "logistics" ||
      doc.source === "rams" ||
      doc.source === "report");

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-lg border bg-card/60 shadow-sm transition hover:shadow-md ${
        doc.archived ? "border-amber-400/40 opacity-70" : "border-border/60 hover:border-border"
      }`}
    >
      <button
        type="button"
        onClick={onView}
        className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/40"
        aria-label={`Preview ${doc.title}`}
      >
        <div ref={sentinelRef} className="pointer-events-none absolute inset-0" aria-hidden />
        {thumb ? (
          <img
            src={thumb}
            alt={doc.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon className={`h-14 w-14 ${color} transition group-hover:opacity-90`} />
        )}
        {doc.archived && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Archived
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-background/80 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/80 opacity-0 backdrop-blur transition group-hover:opacity-100">
          <Eye className="h-3 w-3" /> View
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 border-t border-border/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {doc.category}
          </span>
          <span className="text-[11px] text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground" title={doc.title}>
          {doc.title}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground" title={doc.fileName}>
          {doc.fileName}
          {formatSize(doc.sizeBytes) && ` · ${formatSize(doc.sizeBytes)}`}
        </p>
        <div className="mt-auto flex gap-1.5">
          <button
            type="button"
            onClick={onView}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground/80 transition hover:border-primary/60 hover:text-primary"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </button>
          {canLifecycle && !doc.archived && onArchive && (
            <button
              type="button"
              onClick={onArchive}
              title="Archive (soft-delete)"
              className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-foreground/70 transition hover:border-amber-400/60 hover:text-amber-300"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {canLifecycle && doc.archived && onRestore && (
            <button
              type="button"
              onClick={onRestore}
              title="Restore"
              className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-foreground/70 transition hover:border-emerald-400/60 hover:text-emerald-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
