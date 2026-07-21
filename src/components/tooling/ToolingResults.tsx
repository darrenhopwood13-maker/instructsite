import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, AlertTriangle, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  heading: string;
  body: string;
  isByOthers: boolean;
  index: number;
}

interface ByOthersItem {
  trade: string;
  detail: string;
}

const splitSections = (md: string): Section[] => {
  const parts = md.split(/\n(?=## )/g);
  const sections: Section[] = [];
  let idx = 0;
  for (const part of parts) {
    const m = part.match(/^##\s+(.+?)\n([\s\S]*)$/);
    if (m) {
      sections.push({
        heading: m[1].trim(),
        body: (m[2] ?? "").replace(/^---\s*$/gm, "").trim(),
        isByOthers: /by\s*others/i.test(m[1]),
        index: idx++,
      });
    } else if (part.trim()) {
      sections.push({
        heading: "",
        body: part.replace(/^---\s*$/gm, "").trim(),
        isByOthers: false,
        index: idx++,
      });
    }
  }
  return sections;
};

const parseByOthers = (body: string): ByOthersItem[] => {
  const out: ByOthersItem[] = [];
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const raw of lines) {
    const line = raw
      .replace(/^[-*>•▸]\s*/, "")
      .replace(/^🔴\s*/, "")
      .replace(/^by\s*others[\s:—-]*/i, "");
    const m =
      line.match(/^\*\*([^*]+?)\*\*\s*[:—-]\s*(.+)$/) ||
      line.match(/^([A-Z][A-Z &/]{2,}?)\s*[:—-]\s*(.+)$/);
    if (m) {
      out.push({ trade: m[1].trim().replace(/[:.\s]+$/, ""), detail: m[2].trim() });
    } else if (line.length > 4) {
      out.push({ trade: "Other Trade", detail: line });
    }
  }
  return out;
};

const ByOthersCards = ({ body }: { body: string }) => {
  const items = useMemo(() => parseByOthers(body), [body]);
  if (items.length === 0) {
    return (
      <div className="prose prose-invert max-w-none text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((it, i) => (
        <div
          key={i}
          className="relative rounded-xl border border-alert/40 bg-gradient-to-br from-alert/15 to-alert/5 p-3.5"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-alert text-alert-foreground">
              <HardHat size={14} strokeWidth={2.6} />
            </span>
            <span className="font-display font-bold text-alert tracking-tight text-[13px] uppercase">
              {it.trade}
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-foreground/95">{it.detail}</p>
        </div>
      ))}
    </div>
  );
};

const SectionBlock = ({ section, defaultOpen }: { section: Section; defaultOpen: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!section.heading) {
    return (
      <div className="prose prose-invert max-w-none text-[15px] mb-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden mb-2.5 transition-all",
        section.isByOthers
          ? "border-alert/50 bg-gradient-to-br from-alert/10 to-transparent"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors",
          section.isByOthers ? "hover:bg-alert/10" : "hover:bg-white/[0.04]",
        )}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {section.isByOthers && <AlertTriangle size={16} className="text-alert shrink-0" />}
          <span
            className={cn(
              "font-display font-bold text-[15px] tracking-tight truncate",
              section.isByOthers ? "text-alert uppercase" : "text-foreground",
            )}
          >
            {section.heading.replace(/^[🚨📐🔢📏⚠✅🔍🧰📝]+\s*/u, "")}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1">
          {section.isByOthers ? (
            <ByOthersCards body={section.body} />
          ) : (
            <div className="prose prose-invert max-w-none text-[14.5px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ToolingResults = ({ markdown }: { markdown: string }) => {
  const sections = useMemo(() => splitSections(markdown), [markdown]);
  return (
    <div>
      {sections.map((s) => (
        <SectionBlock
          key={s.index}
          section={s}
          defaultOpen={s.isByOthers || s.index === 0 || s.index === 1}
        />
      ))}
    </div>
  );
};
