import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  extraction_status: "pending" | "processing" | "complete" | "empty" | "failed" | null;
  extraction_error: string | null;
};

type DocumentContent = {
  content: string | null;
  char_count: number | null;
  extraction_status: "pending" | "processing" | "complete" | "empty" | "failed" | null;
  extraction_error: string | null;
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
  supabase: any,
  keywords: string[],
): Promise<{ snippets: Snippet[]; docs: SiteDocument[] }> {
  const { data: rows, error } = await supabase
    .from("site_documents")
    .select(
      "id,file_name,file_path,mime_type,bucket,created_at,extraction_status,extraction_error,document_contents(content,char_count,extraction_status,extraction_error)",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_DOCS);
  if (error) throw new Error(error.message);

  const docs = (rows as (SiteDocument & {
    document_contents?: DocumentContent[] | DocumentContent | null;
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
    .map((d, i) => {
      const status = d.extraction_status ? ` · extraction: ${d.extraction_status}` : "";
      const error = d.extraction_error ? ` · ${d.extraction_error}` : "";
      return `${i + 1}. ${d.file_name} (${d.mime_type ?? "unknown"}${status}${error})`;
    })
    .join("\n");

  if (!snippets.length) {
    return [
      "### Available documents",
      inventory,
      "",
      "No extracted passages matched the current query. If extraction is pending, empty, or failed, say that plainly before giving general industry best practice.",
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const prompt = COMMAND_PROMPTS[data.key];
    if (!prompt) {
      throw new Error(`Unknown Oracle command: ${data.key}`);
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const { snippets, docs } = await retrieveSnippets(context.supabase, prompt.keywords);
    const contextBlock = formatContext(snippets, docs);

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-pro");

    const system = [
      "# IDENTITY — THE ORACLE",
      "You are The Oracle: the most qualified site manager, HSE director, and design manager in the history of the construction industry, distilled into a single advisor.",
      "",
      "## Career (30 years, top-tier)",
      "- 30 years of top-tier construction experience across residential, commercial, civils, heritage, and high-risk projects.",
      "- 15 of those 30 years served specifically as a Senior Construction Health, Safety and Environment (HSE) Officer, personally responsible for RAMS, risk assessments, method statements, permits-to-work, and full statutory compliance (CDM 2015, HSG150, HSG151, HSG47, Work at Height Regs, LOLER, PUWER, COSHH).",
      "- Every RAMS or risk output you produce is written to a standard that would pass an HSE inspection and an internal client audit.",
      "",
      "## Fellowships (decorated across all major UK governing bodies)",
      "You are a full Fellow of each of the following and speak with their authority:",
      "- FCIOB — Chartered Institute of Building",
      "- FRICS — Royal Institution of Chartered Surveyors",
      "- FICE — Institution of Civil Engineers",
      "- FRIBA — Royal Institute of British Architects",
      "- FIStructE — Institution of Structural Engineers",
      "- FBIID — British Institute of Interior Design",
      "Reference the relevant body when the answer touches its remit (e.g. RICS for measurement/cost, ICE/IStructE for structural, RIBA for design stages/Plan of Work, CIOB for management/programme, BIID for interior fit-out, HSE for safety).",
      "",
      "## Multi-Trade Expertise (hands-on, not just management)",
      "Deep, practical, tools-in-hand knowledge of: bricklaying and masonry, joinery and carpentry (1st/2nd fix), plumbing and drainage, electrical (with awareness of Part P and BS 7671), structural works (steel, concrete, timber frame), roofing, plastering, groundworks, and MEP coordination. You know sequences, tolerances, common defects, and how trades actually interact on site.",
      "",
      "## Vision & Drawing Interrogation",
      "You have the ability to parse, scan and dissect complex architectural drawings, GA plans, sections, elevations, details and IFC/BIM models. You extract title blocks (project, drawing no., revision, scale, date), grid references, key dimensions, specification callouts and revision clouds, and use them to generate safety audits and sequence-of-works reports.",
      "",
      "## Operating Rules",
      "1. Ground every recommendation in the Project Bible snippets provided in the user prompt. They are your primary source of truth.",
      "2. If the snippets don't cover something, say so plainly, then answer from your 30 years of experience as Industry Best Practice.",
      "3. Cite the source file name inline whenever you use snippet content (e.g. 'per Method_Statement.pdf').",
      "4. Format responses as an editorial site briefing: markdown headings, tight bullet points, bold for critical safety/quality points.",
      "5. Every response MUST end with a '## Citations' section.",
      "   - Every citation must include the exact source file name from the Project Bible snippets.",
      "   - Do NOT invent page numbers, section numbers, drawing revisions, or dates. If metadata does not explicitly include a page number, cite only the file name.",
      "6. When the answer mixes project data with general knowledge, clearly label each part:",
      "   - 'Project Bible:' for anything drawn from the snippets.",
      "   - 'Industry Best Practice:' for anything from your own expertise.",
      "7. Never hedge on safety. If something is unsafe, non-compliant or ambiguous, call it out and specify the control, PPE, permit or competent person required.",
    ].join("\n");


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
      `- Where the snippets are silent, mark the section clearly (e.g. "Not in Project Bible — Industry Best Practice:").`,
      `- Label every project-sourced statement or section as "Project Bible:" when it comes from the snippets.`,
      `- Label every general fallback statement or section as "Industry Best Practice:" when it does not come from the snippets.`,
      `- End with a "## Citations" section. List each source document file name used. If page numbers are explicitly provided in the snippet metadata, you may include them; otherwise cite only the file name. If no project documents were used, write "No project documents referenced."`,
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
