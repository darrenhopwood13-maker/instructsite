import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export const MarkdownRenderer = ({ content, className }: MarkdownRendererProps) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="font-display text-3xl font-extrabold tracking-tight text-foreground mt-6 mb-4"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="font-display text-2xl font-bold tracking-tight text-foreground mt-5 mb-3"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="font-display text-xl font-bold tracking-tight text-foreground mt-4 mb-2"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4
              className="font-display text-lg font-bold tracking-tight text-foreground mt-4 mb-2"
              {...props}
            />
          ),
          p: ({ node, ...props }) => (
            <p className="font-sans text-base leading-relaxed text-foreground/90 mb-4" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="font-sans text-base leading-relaxed text-foreground/90" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-alert" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-foreground/80" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="glass-accent border-l-4 border-alert/60 pl-4 py-3 pr-4 my-4 rounded-r-lg"
              {...props}
            />
          ),
          code: ({ node, className, children, ...props }) => {
            return (
              <code
                className="bg-foreground/10 text-foreground rounded px-1 py-0.5 text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, children, ...props }) => (
            <pre className="glass-panel p-4 overflow-x-auto rounded-lg mb-4 text-sm" {...props}>
              {children}
            </pre>
          ),
          hr: ({ node, ...props }) => (
            <hr className="border-hairline/30 my-6" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-foreground underline decoration-foreground/40 hover:text-alert transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
