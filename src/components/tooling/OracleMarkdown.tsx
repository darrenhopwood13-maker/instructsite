import { Fragment, type ReactNode } from "react";

// Lightweight, dependency-free markdown renderer tuned for Oracle output.
// Handles: paragraphs, bullet lists (-, *, •), bold **x**, italic *x*, inline code `x`, links [t](u).

const renderInline = (text: string) => {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key++} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-white/10 text-primary font-mono text-[0.9em]">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) nodes.push(<a key={key++} href={lm[2]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{lm[1]}</a>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key++} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

export const OracleMarkdown = ({ children }: { children: string }) => {
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listBuf: string[] = [];
  let paraBuf: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuf.length) {
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1 text-foreground/90">
          {listBuf.map((li, i) => (
            <li key={i}>{renderInline(li)}</li>
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  const flushPara = () => {
    if (paraBuf.length) {
      const text = paraBuf.join(" ");
      blocks.push(
        <p key={key++} className="my-2 text-foreground/90 leading-relaxed">
          {renderInline(text)}
        </p>,
      );
      paraBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    const bullet = line.match(/^\s*[-*•▸]\s+(.*)$/);
    if (bullet) {
      flushPara();
      listBuf.push(bullet[1]);
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      flushList();
      flushPara();
      blocks.push(
        <h3 key={key++} className="font-display text-[15px] font-semibold text-foreground mt-3 mb-1">
          {renderInline(h3[1])}
        </h3>,
      );
      continue;
    }
    flushList();
    paraBuf.push(line);
  }
  flushList();
  flushPara();

  return <Fragment>{blocks}</Fragment>;
};
