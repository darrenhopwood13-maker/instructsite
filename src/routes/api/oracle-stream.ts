import { createFileRoute } from "@tanstack/react-router";
import { ORACLE_PERSONA } from "@/lib/oracle-persona";

const BASE_PERSONA = `${ORACLE_PERSONA}

## Output formatting (tooling cockpit)
- Clean Markdown. **Bold** sub-headers, tight bullet lists.
- Open with one short headline summary line.
- Use ## for every major section — the UI renders each ## section as its own collapsible panel, so keep headings short and self-describing.
- Bullets prefixed with ▸ so they're scannable on a busy site iPad.
- End with a **Next Move** or **Site Call** line — a single decisive recommendation.
- If something is unsafe or non-compliant, prefix the line with **⚠ HOLD**.`;

const PROMPTS: Record<string, string> = {
  installation_sequence: `${BASE_PERSONA}

TASK: INSTALLATION SEQUENCE
Analyse the supplied drawing/photo/PDF (or the user's description) and produce a step-by-step build order.

OUTPUT MUST FOLLOW THIS EXACT STRUCTURE — in this order. Use ## for each section heading. Keep BY OTHERS first.

## BY OTHERS
List every item that is NOT in our scope but MUST be completed by another trade or specialist before/around our works.
Output each item on its own line in this EXACT format — do not deviate, the UI parses these:

**TRADE NAME** — what they must do — when it must be done by — consequence if missed.

Provide 3–8 items unless genuinely none apply (then write a single line: "None identified at this stage.").

## Setting Out & Datums
Soleplate datums and MBC Timber Frame setting-out where applicable.

## Sequence
Number EVERY step explicitly: **Step 1.**, **Step 2.**, **Step 3.** … each on its own line, bold step header then a one-line description.
For each step also note: *Predecessor:* / *Concurrent trades:* / *Hold point:* (if any).

## Tolerances
Key tolerances per BS 5606 / MBC standard details.

## Hold Points & Statutory Flags
BSR / Gateway 2 / CDM dutyholder hold points relevant to the works.

## Next Move
One decisive recommendation.`,
  safety_auditor: `${BASE_PERSONA}

TASK: SAFETY AUDITOR
Audit the drawing/photo/PDF/scenario for site safety and statutory risk.
- BSR / Building Safety Act 2022 implications first if HRB-relevant.
- CDM 2015 dutyholder gaps, working at height, lifting ops (LOLER), fire stopping (Part B), edge protection, MEWP / scaff, exclusion zones.
- Sections (each as ##): ## Immediate Risks, ## Statutory Flags, ## Required RAMS & Permits, ## Site Call.`,
  procurement: `${BASE_PERSONA}

TASK: PROCUREMENT — HIGH-END FINISHES
Assess lead times and procurement risk for the items shown / asked about. Assume Mayfair / luxury-grade spec.
- Realistic UK lead times in weeks, factory + delivery + install.
- Long-lead callouts and mitigations (substitution, partial release, bonded warehouse).
- Sections (each as ##): ## Item Summary, ## Lead Times, ## Risks, ## Procurement Call.`,
  drawing_qa: `${BASE_PERSONA}

TASK: DRAWING Q&A
Answer the user's specific technical question against the supplied drawing/photo/PDF.
- If the drawing doesn't show the answer, say so plainly and state what view/section is needed.
- Cite zones / grids / detail refs visible on the drawing.
- Sections (each as ##): ## Answer, ## Reasoning, ## What to Check On Site.`,
  snag_master: `${BASE_PERSONA}

TASK: SNAG MASTER
Identify quality / snagging issues from the photo.
- Severity grade each: 🟢 Minor cosmetic · 🟡 Trade re-attend · 🔴 Reject / rip out.
- Reference the relevant BS / NHBC / Approved Document where applicable.
- Sections (each as ##): ## Snags, ## Root Cause, ## Remedial Action, ## Sign-off Criteria.`,
  ai_assist: `${BASE_PERSONA}

TASK: AI ASSIST — FULL ORACLE
General high-level site logic, problem solving, and Clerk of Works reasoning.
- Be decisive. Provide a recommended call, not a menu.
- Use ## headers per section. Always finish with a ## Site Call section.`,
};

const MAX_PDF_CHARS = 40_000;

async function extractPdfText(base64: string): Promise<{ text: string; pageCount: number }> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;
  return { text: merged.replace(/\s+/g, " ").trim(), pageCount: totalPages ?? 0 };
}

export const Route = createFileRoute("/api/oracle-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: {
          buttonFunction?: string;
          base64Image?: string | null;
          pdfBase64?: string | null;
          pdfFileName?: string | null;
          userQuestion?: string;
        };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }

        const { buttonFunction, base64Image, pdfBase64, pdfFileName, userQuestion } = body;
        if (!buttonFunction || !PROMPTS[buttonFunction]) {
          return new Response(JSON.stringify({ error: "Invalid buttonFunction" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let pdfWarning: string | null = null;
        let pdfBlock: string | null = null;
        if (pdfBase64 && typeof pdfBase64 === "string") {
          try {
            const { text, pageCount } = await extractPdfText(pdfBase64);
            if (!text) {
              pdfWarning =
                "This PDF has no selectable text (likely scanned). Export a text-based PDF or attach as an image.";
            } else {
              const truncated = text.length > MAX_PDF_CHARS;
              const clip = truncated ? text.slice(0, MAX_PDF_CHARS) : text;
              pdfBlock = `[Attached PDF: ${pdfFileName ?? "document.pdf"}, ${pageCount} page${pageCount === 1 ? "" : "s"}${truncated ? ", truncated" : ""}]\n\n${clip}`;
            }
          } catch (err) {
            console.error("PDF extract failed:", err);
            pdfWarning = "Could not read the PDF text — try re-exporting or attach as an image.";
          }
        }

        const baseText =
          userQuestion?.trim() ||
          (base64Image || pdfBlock
            ? "Analyse the attached material per the task brief above."
            : "Provide your standard analysis per the task brief above.");

        const userText = pdfBlock ? `${baseText}\n\n${pdfBlock}` : baseText;

        const userContent: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
        if (base64Image && typeof base64Image === "string" && base64Image.startsWith("data:")) {
          userContent.push({ type: "image_url", image_url: { url: base64Image } });
        }

        const messages = [
          { role: "system", content: PROMPTS[buttonFunction] },
          { role: "user", content: userContent },
        ];

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "google/gemini-2.5-pro", messages, stream: true }),
        });

        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          const status = upstream.status;
          const msg =
            status === 429
              ? "Rate limit hit — hold on and try again in a moment."
              : status === 402
                ? "Out of Lovable AI credits — top up the workspace to keep the Oracle online."
                : `AI gateway error (${status})`;
          console.error("Oracle upstream error:", status, errText);
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const headers: Record<string, string> = {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        };
        if (pdfWarning) headers["x-oracle-warning"] = pdfWarning;

        return new Response(upstream.body, { headers });
      },
    },
  },
});
