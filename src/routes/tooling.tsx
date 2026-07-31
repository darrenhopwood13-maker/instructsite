import { useRef, useState } from "react";
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
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeFunction, setActiveFunction] = useState<FunctionKey | null>(null);
  const [lastFailed, setLastFailed] = useState<FunctionKey | null>(null);
  const inFlightRef = useRef(false);

  const reset = () => {
    setOutput("");
    setActiveFunction(null);
    setLastFailed(null);
  };

  const clearAttachment = () => {
    setImageDataUrl(null);
    setPdfBase64(null);
    setFileName(null);
  };

  const runOracle = async (fn: FunctionKey) => {
    // Guard on a ref, not state — two fast clicks in the same tick both saw
    // isStreaming === false and could leave the UI in a dead state.
    if (inFlightRef.current) return;
    if (fn === "snag_master" && !imageDataUrl) {
      toast.error("Attach a photo first for the Snag Master.");
      return;
    }

    inFlightRef.current = true;
    setActiveFunction(fn);
    setLastFailed(null);
    setOutput("");
    setIsStreaming(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000);

    try {
      const resp = await fetch("/api/oracle-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          buttonFunction: fn,
          base64Image: imageDataUrl,
          pdfBase64,
          pdfFileName: pdfBase64 ? fileName : null,
          userQuestion: question,
        }),
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
        else if (resp.status === 402) toast.error("AI service unavailable", { description: msg });
        else toast.error("Oracle error", { description: msg });
        setLastFailed(fn);
        return;
      }

      const warning = resp.headers.get("x-oracle-warning");
      if (warning) toast.warning("PDF notice", { description: warning });

      if (!resp.body) {
        toast.error("No stream from The Oracle.", { description: "Press RETRY to run it again." });
        setLastFailed(fn);
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

      if (!assistantSoFar.trim()) {
        setLastFailed(fn);
        toast.error("The Oracle returned nothing", {
          description: "The stream ended empty. Press RETRY to run it again.",
        });
      }
    } catch (err) {
      console.error(err);
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setLastFailed(fn);
      toast.error(aborted ? "The Oracle timed out" : "Oracle comms dropped", {
        description: aborted
          ? "No response within 2 minutes. Press RETRY to run it again."
          : err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      window.clearTimeout(timeout);
      inFlightRef.current = false;
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
          imageDataUrl={imageDataUrl}
          pdfBase64={pdfBase64}
          fileName={fileName}
          onRemoveImage={clearAttachment}
          footer={
            <ScanUpload
              imageDataUrl={imageDataUrl}
              pdfBase64={pdfBase64}
              onImage={(d, n) => {
                setImageDataUrl(d);
                setFileName(n);
              }}
              onPdf={(b, n) => {
                setPdfBase64(b);
                setFileName(n);
              }}
              fileName={fileName}
            />
          }
        />

        {lastFailed && !isStreaming && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-alert/40 bg-alert/10 px-4 py-3">
            <span className="text-sm text-foreground">
              {ACTION_LABELS[lastFailed]} did not return anything.
            </span>
            <button
              type="button"
              onClick={() => void runOracle(lastFailed)}
              className="font-mono text-[11px] uppercase tracking-widest rounded-lg border border-alert/60 px-3 py-1.5 text-alert hover:bg-alert/15"
            >
              Retry
            </button>
          </div>
        )}

        <PromptInput value={question} onChange={setQuestion} disabled={isStreaming} />

        <ActionGrid onSelect={runOracle} disabled={isStreaming} active={activeFunction} loading={isStreaming} />
      </main>

    </div>
  );
}
