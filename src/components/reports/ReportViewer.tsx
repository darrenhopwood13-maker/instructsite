import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Download, Share2, Printer, BookmarkPlus, Loader2, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { addReportToProjectBible } from "@/lib/project-bible.functions";

export type ReportCategory = "Oracle" | "Snag" | "Programme" | "Custom";

export type ReportViewerProps = {
  open: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  subtitle?: string;
  category: ReportCategory;
  /** Markdown source used for PDF/Bible export; sections come from H2 headings. */
  markdown?: string;
  /** When markdown isn't the natural source, provide a plain text export. */
  exportText?: string;
  /** Optional pre-composed body; overrides markdown auto-sectioning. */
  children?: ReactNode;
  /** Enables "Add to Project Bible" when present. */
  projectId?: string | null;
  /** Optional deep link used by Share. */
  shareUrl?: string;
};

async function downloadAsPdf(rootEl: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(rootEl, {
    backgroundColor: "#0b1220",
    scale: 2,
    useCORS: true,
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position = heightLeft - imgH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  pdf.save(filename);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "report";
}

/** Split markdown into sections by H2 (## Heading). */
function splitMarkdown(md: string): { title: string; body: string }[] {
  const lines = md.split(/\r?\n/);
  const sections: { title: string; body: string }[] = [];
  let currentTitle = "Overview";
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body || sections.length === 0) sections.push({ title: currentTitle, body });
    buf = [];
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      currentTitle = m[1];
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections.filter((s) => s.body.length > 0 || s.title !== "Overview");
}

function InlineMd({ text }: { text: string }) {
  // very small inline renderer: bold **x**, italic *x*, `code`, links [t](u), lists, headings h3+
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-accent underline" href="$2" target="_blank" rel="noreferrer">$1</a>');
  return <div className="report-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function MarkdownBody({ md }: { md: string }) {
  const blocks: ReactNode[] = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*###\s+/.test(line)) {
      blocks.push(
        <h4 key={key++} className="mt-4 text-sm font-bold uppercase tracking-widest text-white/90">
          {line.replace(/^\s*###\s+/, "")}
        </h4>,
      );
      i++;
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="mt-2 list-disc space-y-1 pl-6 text-sm leading-relaxed text-white">
          {items.map((it, idx) => <li key={idx}><InlineMd text={it} /></li>)}
        </ul>,
      );
    } else if (line.trim() === "") {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^\s*(###\s+|[-*]\s+)/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push(
        <p key={key++} className="mt-2 text-sm leading-relaxed text-white">
          <InlineMd text={buf.join(" ")} />
        </p>,
      );
    }
  }
  return <>{blocks}</>;
}

function ReportSectionCard({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-sm open:shadow-lg"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          <h3
            className="text-sm font-extrabold uppercase tracking-[0.25em] text-white"
            style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif" }}
          >
            {title}
          </h3>
        </div>
        <span className="text-white/60 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-white/15 px-5 py-4 text-white">{children}</div>
    </details>
  );
}

export function ReportViewer(props: ReportViewerProps) {
  const {
    open,
    onClose,
    kicker = "Report",
    title,
    subtitle,
    category,
    markdown,
    exportText,
    children,
    projectId,
    shareUrl,
  } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bibleState, setBibleState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [bibleError, setBibleError] = useState<string | null>(null);
  const addToBible = useServerFn(addReportToProjectBible);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const filename = `${slugify(title)}.pdf`;

  const handlePrint = () => {
    document.body.setAttribute("data-report-printing", "1");
    window.print();
    setTimeout(() => document.body.removeAttribute("data-report-printing"), 500);
  };

  const handlePdf = async () => {
    if (!bodyRef.current) return;
    await downloadAsPdf(bodyRef.current, filename);
  };

  const handleShare = async () => {
    const url = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    const text = `${title}\n\n${url}`;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.share) {
        await nav.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleAddToBible = async () => {
    if (!projectId) return;
    setBibleState("saving");
    setBibleError(null);
    try {
      await addToBible({
        data: {
          projectId,
          title,
          category,
          markdown: markdown ?? exportText ?? title,
        },
      });
      setBibleState("saved");
    } catch (err) {
      setBibleState("error");
      setBibleError(err instanceof Error ? err.message : "Could not add to Bible.");
    }
  };

  const canBible = Boolean(projectId);

  const sections = children
    ? null
    : markdown
      ? splitMarkdown(markdown)
      : [];

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col text-white"
      style={{ background: "linear-gradient(180deg, #0B1E3F 0%, #0A1733 60%, #081228 100%)" }}
      data-report-viewer
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top bar */}
      <header
        className="relative z-[1] flex flex-wrap items-start justify-between gap-4 border-b border-white/15 bg-black/30 px-6 py-4 md:px-10"
        data-report-toolbar
      >
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-orange-400">
            {kicker}
          </p>
          <h2
            className="mt-1 truncate text-2xl font-extrabold uppercase tracking-tight text-white md:text-3xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-white/70">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" data-report-actions>
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-widest text-white hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-widest text-white hover:bg-white/20"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-widest text-white hover:bg-white/20"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={handleAddToBible}
            disabled={!canBible || bibleState === "saving" || bibleState === "saved"}
            title={canBible ? "File this report in the Project Bible" : "Link this report to a project to file it"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs uppercase tracking-widest text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bibleState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : bibleState === "saved" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            {bibleState === "saved" ? "Filed" : "Add to Bible"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {bibleError && (
        <div className="relative z-[1] border-b border-orange-400/40 bg-orange-500/10 px-6 py-2 text-xs text-orange-200 md:px-10">
          {bibleError}
        </div>
      )}

      {/* Body */}
      <main
        className="relative z-[1] flex-1 overflow-y-auto px-4 py-6 text-white md:px-10 md:py-8"
        data-report-print-root
      >
        <div ref={bodyRef} className="mx-auto grid max-w-5xl gap-4 text-white">
          {children ?? (
            (sections ?? []).length === 0 ? (
              <ReportSectionCard title="Report">
                <MarkdownBody md={markdown ?? exportText ?? "_No content._"} />
              </ReportSectionCard>
            ) : (
              (sections ?? []).map((s, idx) => (
                <ReportSectionCard key={idx} title={s.title} defaultOpen={idx < 2}>
                  <MarkdownBody md={s.body} />
                </ReportSectionCard>
              ))
            )
          )}
        </div>
      </main>
    </div>
  );
}

/** Bordered, collapsible section for callers that compose their own body. */
export function ReportSection(props: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return <ReportSectionCard {...props} />;
}
