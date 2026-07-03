import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const COMMAND_PROMPTS: Record<
  string,
  { title: string; focus: string; keywords: string[] }
> = {
  installation: {
    title: "Installation Sequence",
    focus:
      "Produce a clear, numbered installation and commissioning sequence. Include safety checkpoints and hand-off criteria.",
    keywords: [
      "install", "installation", "sequence", "method", "commission",
      "commissioning", "erection", "assembly", "fit", "mount", "step",
    ],
  },
  safety: {
    title: "Safety Auditor",
    focus:
      "Produce a RAMS-style risk assessment: hazards, likelihood/severity, mitigations, PPE, and compliance references.",
    keywords: [
      "safety", "rams", "risk", "hazard", "ppe", "coshh", "control",
      "mitigation", "assessment", "emergency", "toolbox", "permit",
    ],
  },
  procurement: {
    title: "Procurement",
    focus:
      "Draft a Bill of Materials outline with categories, vendors, and expected lead times. Flag long-lead items.",
    keywords: [
      "bom", "bill", "material", "procure", "procurement", "vendor",
      "supplier", "lead", "delivery", "order", "cost", "quote", "schedule",
    ],
  },
  drawing: {
    title: "Drawing Q&A",
    focus:
      "Interrogate the drawing set: annotations, revisions, key dimensions, and typical site questions.",
    keywords: [
      "drawing", "dwg", "plan", "elevation", "section", "detail",
      "revision", "rev", "dimension", "scale", "grid", "level", "datum",
    ],
  },
  snag: {
    title: "Snag Master",
    focus:
      "Produce a snag-capture checklist covering common defect categories, severity grading, and closeout workflow.",
    keywords: [
      "snag", "defect", "punch", "handover", "closeout", "rework",
      "inspection", "quality", "qa", "nonconformance", "finish",
    ],
  },
  assist: {
    title: "AI Assist",
    focus:
      "Act as an on-site knowledge co-pilot. Summarise what the current project documents cover and how they help today's work.",
    keywords: [
      "project", "site", "scope", "programme", "schedule", "team",
      "contractor", "specification", "spec",
    ],
  },
};

type SiteDocument = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  bucket: string | null;
  created_at: string | null;
};

type Snippet = {
  fileName: string;
  score: number;
  text: string;
};

const MAX_DOCS = 6;
const MAX_SNIPPETS = 5;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function scoreChunk(chunk: string, keywords: string[]): number {
  if (!keywords.length) return 0;
  const lower = chunk.toLowerCase();
  let score = 0;
  const hit = new Set<string>();
  for (const kw of keywords) {
    const matches = lower.match(new RegExp(`\\b${kw.toLowerCase()}\\b`, "g"));
    if (matches) {
      score += matches.length;
      hit.add(kw);
    }
  }
  // Bonus for keyword diversity
  score += hit.size * 2;
  return score;
}

async function retrieveSnippets(
  keywords: string[],
): Promise<{ snippets: Snippet[]; docs: SiteDocument[] }> {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey) return { snippets: [], docs: [] };

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  // Pull latest docs with their extracted content joined in
  const { data: rows } = await supabaseAdmin
    .from("site_documents")
    .select(
      "id,file_name,file_path,mime_type,bucket,created_at,document_contents(content,char_count)",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_DOCS);

  const docs = (rows as (SiteDocument & {
    document_contents?: { content: string | null; char_count: number | null }[] | null;
  })[] | null) ?? [];
  if (!docs.length) return { snippets: [], docs };

  const scored: Snippet[] = [];

  for (const doc of docs) {
    const joined = doc.document_contents;
    const contentRow = Array.isArray(joined) ? joined[0] : joined;
    const text = contentRow?.content?.trim();
    if (!text) continue;

    const chunks = chunkText(text);
    for (const chunk of chunks) {
      const score = scoreChunk(chunk, keywords);
      if (score > 0) {
        scored.push({ fileName: doc.file_name, score, text: chunk });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return { snippets: scored.slice(0, MAX_SNIPPETS), docs };
}


function formatContext(snippets: Snippet[], docs: SiteDocument[]): string {
  if (!docs.length) {
    return "No project documents are available in the Project Bible yet.";
  }
  const inventory = docs
    .map((d, i) => `${i + 1}. ${d.file_name} (${d.mime_type ?? "unknown"})`)
    .join("\n");

  if (!snippets.length) {
    return [
      "### Available documents",
      inventory,
      "",
      "No passages in these documents matched the current query.",
    ].join("\n");
  }

  const passages = snippets
    .map(
      (s, i) =>
        `--- Snippet ${i + 1} · Source: ${s.fileName} · Relevance: ${s.score} ---\n${s.text}`,
    )
    .join("\n\n");

  return [
    "### Available documents",
    inventory,
    "",
    "### Most relevant passages (retrieved from PDF content)",
    passages,
  ].join("\n");
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

    const { snippets, docs } = await retrieveSnippets(prompt.keywords);
    const contextBlock = formatContext(snippets, docs);

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = [
      "You are a Senior Site Manager on a live construction project.",
      "Use the Project Bible snippets provided as your primary source of truth.",
      "If the information isn't in the snippets, clearly state that, then provide general industry best practice as a fallback.",
      "When you use a snippet, cite the source file name inline (e.g. 'per Method_Statement.pdf').",
      "Format the response as an editorial briefing using markdown headings, bullet points, and bold for key insights.",
    ].join(" ");

    const userPrompt = [
      `## Task`,
      `Provide the ${prompt.title} briefing. ${prompt.focus}`,
      ``,
      `## Project Bible Context`,
      contextBlock,
      ``,
      `## Instructions`,
      `- Ground every recommendation in the retrieved snippets above where possible.`,
      `- Reference source file names inline when quoting or paraphrasing.`,
      `- Where the snippets are silent, mark the section clearly (e.g. "Not in Project Bible — industry best practice:") and continue.`,
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
      documentsUsed: Array.from(new Set(snippets.map((s) => s.fileName))),
    };
  });
