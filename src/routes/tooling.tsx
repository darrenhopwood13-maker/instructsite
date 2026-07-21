import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ToolingTerminal } from "@/components/tooling/ToolingTerminal";
import { ScanUpload } from "@/components/tooling/ScanUpload";
import { PromptInput } from "@/components/tooling/PromptInput";
import { ActionGrid, ACTION_LABELS, type FunctionKey } from "@/components/tooling/ActionGrid";

export const Route = createFileRoute("/tooling")({
  head: () => ({
    meta: [
      { title: "The Oracle · instructSite AI Tooling" },
      { name: "description", content: "The Oracle — Senior Clerk of Works AI for UK construction site managers." },
      { property: "og:title", content: "The Oracle · instructSite AI Tooling" },
      { property: "og:description", content: "The Oracle — Senior Clerk of Works AI for UK construction site managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ToolingPage,
});

function ToolingPage() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeFunction, setActiveFunction] = useState<FunctionKey | null>(null);

  const reset = () => {
    setOutput("");
    setActiveFunction(null);
  };

  const runOracle = async (fn: FunctionKey) => {
    if (isStreaming) return;
    if (fn === "snag_master" && !imageDataUrl) {
      toast.error("Attach a photo first for the Snag Master.");
      return;
    }

    setActiveFunction(fn);
    setOutput("");
    setIsStreaming(true);

    try {
      const resp = await fetch("/api/oracle-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buttonFunction: fn, base64Image: imageDataUrl, userQuestion: question }),
      });

      if (!resp.ok) {
        let msg = "The Oracle is offline — try again.";
        try {
          const j = await resp.json();
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        if (resp.status === 429) toast.error("Rate limit", { description: msg });
        else if (resp.status === 402) toast.error("Credits required", { description: msg });
        else toast.error("Oracle error", { description: msg });
        setIsStreaming(false);
        return;
      }

      if (!resp.body) {
        toast.error("No stream from The Oracle.");
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setOutput(assistantSoFar);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (const raw of textBuffer.split("\n")) {
          if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setOutput(assistantSoFar);
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Oracle comms dropped", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-3 sm:px-4 py-5 sm:py-7 max-w-5xl space-y-5">
        <ToolingTerminal
          output={output}
          isStreaming={isStreaming}
          activeFunction={activeFunction ? ACTION_LABELS[activeFunction] : null}
          onReset={reset}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <ScanUpload
            imageDataUrl={imageDataUrl}
            onImage={(d, n) => {
              setImageDataUrl(d);
              setFileName(n);
            }}
            fileName={fileName}
          />
          <PromptInput value={question} onChange={setQuestion} disabled={isStreaming} />
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              ▸ Actions
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
          </div>
          <ActionGrid onSelect={runOracle} disabled={isStreaming} active={activeFunction} loading={isStreaming} />
        </div>
      </main>
    </div>
  );
}
