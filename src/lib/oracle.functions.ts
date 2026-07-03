import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const COMMAND_PROMPTS: Record<
  string,
  { title: string; focus: string; keywords: string[] }
> = {
  installation: {
    title: "Installation Sequence",
    focus:
      "Produce a clear, numbered installation and commissioning sequence. Include safety checkpoints and hand-off criteria.",
    keywords: ["install", "sequence", "method", "commission", "erection"],
  },
  safety: {
    title: "Safety Auditor",
    focus:
      "Produce a RAMS-style risk assessment: hazards, likelihood/severity, mitigations, PPE, and compliance references.",
    keywords: ["safety", "rams", "risk", "hazard", "ppe", "coshh"],
  },
  procurement: {
    title: "Procurement",
    focus:
      "Draft a Bill of Materials outline with categories, vendors, and expected lead times. Flag long-lead items.",
    keywords: ["bom", "material", "procure", "vendor", "supplier", "schedule"],
  },
  drawing: {
    title: "Drawing Q&A",
    focus:
      "Interrogate the drawing set: annotations, revisions, key dimensions, and typical site questions.",
    keywords: ["drawing", "dwg", "plan", "section", "detail", "revision"],
  },
  snag: {
    title: "Snag Master",
    focus:
      "Produce a snag-capture checklist covering common defect categories, severity grading, and closeout workflow.",
    keywords: ["snag", "defect", "punch", "handover", "closeout"],
  },
  assist: {
    title: "AI Assist",
    focus:
      "Act as an on-site knowledge co-pilot. Summarise what the current project documents cover and how they help today's work.",
    keywords: [],
  },
};

type SiteDocument = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  bucket: string | null;
  created_at: string | null;
};

async function fetchRelevantDocuments(keywords: string[]): Promise<SiteDocument[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  // Try keyword-scoped search first
  if (keywords.length) {
    const orFilter = keywords
      .map((k) => `file_name.ilike.%${k}%`)
      .join(",");
    const { data } = await supabase
      .from("site_documents")
      .select("id,file_name,file_path,file_size,mime_type,bucket,created_at")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(8);
    if (data && data.length > 0) return data as SiteDocument[];
  }

  // Fallback: latest uploads
  const { data } = await supabase
    .from("site_documents")
    .select("id,file_name,file_path,file_size,mime_type,bucket,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  return (data as SiteDocument[]) ?? [];
}

function formatDocumentContext(docs: SiteDocument[]): string {
  if (!docs.length) return "No project documents are available in the Project Bible yet.";
  return docs
    .map((d, i) => {
      const size = d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "unknown size";
      const type = d.mime_type ?? "unknown type";
      const uploaded = d.created_at ? new Date(d.created_at).toISOString().slice(0, 10) : "unknown date";
      return `${i + 1}. ${d.file_name} — ${type}, ${size}, uploaded ${uploaded} (path: ${d.file_path})`;
    })
    .join("\n");
}

export const runOracleCommand = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const prompt = COMMAND_PROMPTS[data.key];
    if (!prompt) {
      throw new Error(`Unknown Oracle command: ${data.key}`);
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const docs = await fetchRelevantDocuments(prompt.keywords);
    const contextBlock = formatDocumentContext(docs);

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = [
      "You are a Senior Site Manager on a live construction project.",
      "Use the provided site documents (the Project Bible) as your primary source of truth.",
      "If the information isn't in the documents, clearly state that, then provide general industry best practice as a fallback.",
      "Always cite the document file names you drew from in a short 'Sources' section at the end.",
      "Format the response as a clean editorial briefing using markdown headings, bullet points, and bold for key insights.",
    ].join(" ");

    const userPrompt = [
      `## Task`,
      `Provide the ${prompt.title} briefing. ${prompt.focus}`,
      ``,
      `## Project Bible — Available Site Documents`,
      contextBlock,
      ``,
      `## Instructions`,
      `- Ground every recommendation in the documents above where possible.`,
      `- When a document is relevant, reference it by file name inline.`,
      `- Where the documents are silent, mark the section clearly (e.g. "Not in Project Bible — industry best practice:") and continue.`,
      `- End with a "Sources" section listing document file names used, or "No project documents referenced" if none applied.`,
    ].join("\n");

    const { text } = await generateText({
      model,
      system,
      prompt: userPrompt,
    });

    return {
      title: prompt.title,
      answer: text,
      documentsUsed: docs.map((d) => d.file_name),
    };
  });
