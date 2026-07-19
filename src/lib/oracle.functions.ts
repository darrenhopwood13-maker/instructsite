import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
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

async function scopedDocumentIds(
  supabase: any,
  projectId: string,
): Promise<string[]> {
  const ids = new Set<string>();
  const tables = ["project_drawings", "logistics_plans", "rams_documents"] as const;
  for (const t of tables) {
    const { data, error } = await supabase
      .from(t)
      .select("site_document_id")
      .eq("project_id", projectId);
    if (error) continue;
    for (const row of data ?? []) {
      if (row?.site_document_id) ids.add(row.site_document_id as string);
    }
  }
  return Array.from(ids);
}

async function retrieveSnippets(
  supabase: any,
  keywords: string[],
  projectId: string | null,
): Promise<{ snippets: Snippet[]; docs: SiteDocument[] }> {
  let query = supabase
    .from("site_documents")
    .select(
      "id,file_name,file_path,mime_type,bucket,created_at,extraction_status,extraction_error,document_contents(content,char_count,extraction_status,extraction_error)",
    )
    .order("created_at", { ascending: false });

  if (projectId) {
    const ids = await scopedDocumentIds(supabase, projectId);
    if (ids.length === 0) return { snippets: [], docs: [] };
    query = query.in("id", ids).limit(MAX_DOCS * 3);
  } else {
    query = query.limit(MAX_DOCS);
  }

  const { data: rows, error } = await query;
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
  return { snippets: scored.slice(0, MAX_SNIPPETS), docs: docs.slice(0, MAX_DOCS) };
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
    z
      .object({
        key: z.string().min(1),
        projectId: z.string().uuid().optional(),
        lockedContext: z
          .object({
            kind: z.enum(["drawing", "zone"]),
            id: z.string(),
            label: z.string(),
          })
          .optional(),
      })
      .parse(input),
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

    const { snippets, docs } = await retrieveSnippets(
      context.supabase,
      prompt.keywords,
      data.projectId ?? null,
    );
    const contextBlock = formatContext(snippets, docs);
    const lockLine = data.lockedContext
      ? `\n### Locked Focus\nThe user has locked this session to ${data.lockedContext.kind.toUpperCase()}: **${data.lockedContext.label}** (id ${data.lockedContext.id}). Prioritize this element above all else.\n`
      : "";


    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

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
      "Deep, practical, tools-in-hand knowledge of: bricklaying and masonry, joinery and carpentry (1st/2nd fix), plumbing and drainage, electrical (with awareness of Part P and BS 7671), structural works (steel, concrete, timber frame), roofing, plastering, groundworks, and MEP coordination.",
      "",
      "## Vision & Drawing Interrogation",
      "You have the ability to parse, scan and dissect complex architectural drawings, GA plans, sections, elevations, details and IFC/BIM models. You extract title blocks, grid references, key dimensions, specification callouts and revision clouds, and use them to generate safety audits and sequence-of-works reports.",
      "",
      "## Operating Rules",
      "1. Ground every recommendation in the Project Bible snippets provided in the user prompt. They are your primary source of truth.",
      "2. If the snippets don't cover something, say so plainly, then answer from your 30 years of experience as Industry Best Practice.",
      "3. Cite the source file name inline whenever you use snippet content (e.g. 'per Method_Statement.pdf').",
      "4. Format responses as an editorial site briefing: markdown headings, tight bullet points, bold for critical safety/quality points.",
      "5. Every response MUST end with a '## Citations' section listing the exact source file names used. Do NOT invent page numbers, section numbers, drawing revisions, or dates.",
      "6. Label 'Project Bible:' for snippet-sourced content and 'Industry Best Practice:' for general expertise.",
      "7. Never hedge on safety. Call out non-compliant or ambiguous items and specify the control, PPE, permit or competent person required.",
    ].join("\n");


    const userPrompt = [
      `## Task`,
      `Provide the ${prompt.title} briefing. ${prompt.focus}`,
      lockLine,
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
      `- End with a "## Citations" section. List each source document file name used. Cite only file names unless page numbers are explicitly provided in the snippet metadata. If no project documents were used, write "No project documents referenced."`,
    ].join("\n");

    let text: string;
    try {
      const res = await generateText({
        model,
        system,
        prompt: userPrompt,
      });
      text = res.text;
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      console.error("[Oracle] AI Gateway call failed", msg);
      // Surface a clean user-facing error instead of a raw SDK stack trace
      if (/rate.?limit|429/i.test(msg)) {
        throw new Error("Oracle is rate-limited. Please retry in a moment.");
      }
      if (/402|credit/i.test(msg)) {
        throw new Error("Oracle credits exhausted. Add credits in Settings → Plans & credits.");
      }
      throw new Error(`Oracle model call failed: ${msg}`);
    }


    return {
      title: prompt.title,
      answer: text,
      documentsUsed: Array.from(new Set(snippets.map((s) => s.fileName))),
    };
  });

// Free-form Q&A: subcontractor mobile Oracle chat. Project-scoped, optional drawing lock.
function extractKeywords(q: string): string[] {
  const stop = new Set([
    "the","a","an","of","for","in","on","at","to","and","or","is","are","be",
    "this","that","what","which","how","when","where","do","does","with","from",
    "my","your","our","it","its","as","by","not",
  ]);
  const words = q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  const kw = words.filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(kw)).slice(0, 20);
}

export const askProjectOracle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().trim().min(2).max(1000),
        projectId: z.string().uuid(),
        drawingId: z.string().uuid().optional(),
        drawingLabel: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const keywords = extractKeywords(data.question);
    const { snippets, docs } = await retrieveSnippets(
      context.supabase,
      keywords.length ? keywords : ["project", "drawing", "spec"],
      data.projectId,
    );
    const contextBlock = formatContext(snippets, docs);
    const lockLine = data.drawingId
      ? `\n### Locked Drawing\nUser has selected drawing: **${data.drawingLabel ?? data.drawingId}** (id ${data.drawingId}). Prioritize this drawing's specification, dimensions and notes.\n`
      : "";

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = [
      "You are The Oracle — a decorated 30-year senior construction & HSE advisor.",
      "Answer the site subcontractor's question crisply.",
      "Ground every claim in the Project Bible snippets when present; cite source file names inline.",
      "If the snippets do not cover it, say 'Not in Project Bible — Industry Best Practice:' and answer from expertise.",
      "Never hedge on safety. Be direct, short, and specific to what the operative needs on site right now.",
      "End with a short 'Sources' line listing file names used, or 'Sources: none'.",
    ].join("\n");

    const userPrompt = [
      "## Question",
      data.question,
      lockLine,
      "",
      "## Project Bible Context",
      contextBlock,
    ].join("\n");

    let text: string;
    try {
      const res = await generateText({ model, system, prompt: userPrompt });
      text = res.text;
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      if (/rate.?limit|429/i.test(msg)) throw new Error("Oracle is rate-limited. Please retry in a moment.");
      if (/402|credit/i.test(msg)) throw new Error("Oracle credits exhausted. Add credits in Settings → Plans & credits.");
      throw new Error(`Oracle model call failed: ${msg}`);
    }

    return {
      answer: text,
      documentsUsed: Array.from(new Set(snippets.map((s) => s.fileName))),
    };
  });

/**
 * Oracle Scan — upload a photo of anything on site and get the full Oracle
 * identity (30yr site manager + all 6 fellowships) to analyse it.
 * Uses GPT-4o Vision for rich visual understanding with structured response.
 */
const PhotoScanSchema = z.object({
  assessmentTitle: z.string(),
  summary: z.string(),
  keyFindings: z.array(z.string()),
  regulatoryReferences: z.array(z.string()),
  recommendations: z.array(z.string()),
  riskFlags: z.array(z.string()),
  tradeInvolved: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

export const oracleScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fileName: z.string(),
        mimeType: z.string(),
        dataBase64: z.string().min(1),
        scanContext: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    if (!/^image\//i.test(data.mimeType)) {
      throw new Error("Please upload an image file.");
    }

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;

    const system = [
      "# IDENTITY — THE ORACLE (Site Scan Mode)",
      "You are The Oracle: the most qualified site manager, HSE director, design manager, architect, and engineer in the history of the construction industry — distilled into a single advisor.",
      "",
      "## Career (30 years, top-tier)",
      "- 30 years of top-tier construction experience across residential, commercial, civils, heritage, and high-risk projects.",
      "- 15 of those 30 years served specifically as a Senior Construction Health, Safety and Environment (HSE) Officer.",
      "",
      "## Fellowships (decorated across all major UK governing bodies)",
      "You are a full Fellow of each of the following and speak with their authority:",
      "- FCIOB — Chartered Institute of Building",
      "- FRICS — Royal Institution of Chartered Surveyors",
      "- FICE — Institution of Civil Engineers",
      "- FRIBA — Royal Institute of British Architects",
      "- FIStructE — Institution of Structural Engineers",
      "- FBIID — British Institute of Interior Design",
      "- FENSA — Fenestration Self-Assessment Scheme (windows, doors, glazing — Building Regs Part L/F/Q)",
      "- NICEIC — National Inspection Council for Electrical Installation Contracting (Part P, BS 7671)",
      "",
      "## Multi-Trade Expertise (hands-on)",
      "Deep, practical knowledge of: bricklaying and masonry, joinery and carpentry (1st/2nd fix), plumbing and drainage, electrical (Part P, BS 7671), structural works (steel, concrete, timber frame), roofing, plastering, groundworks, and MEP coordination.",
      "",
      "## Operating Rules",
      "1. You are analysing a photograph taken on a construction site. It could be anything: a defect, a work-in-progress, site conditions, a drawing, a material, or a safety concern.",
      "2. Assess what you see through the lens of all your fellowships — design quality (RIBA), structural integrity (IStructE), measurement/standards (RICS), programme/management (CIOB), interior fit-out (BIID), safety (HSE).",
      "3. Be blunt and honest. If something looks wrong, say so. If it looks good, say that too.",
      "4. Cite the relevant fellowship body inline when your assessment touches its remit (RICS, IStructE, ICE, RIBA, CIOB, BIID, FENSA for glazing/fenestration, NICEIC / BS 7671 for electrical).",
      "5. Reference real UK regulations where applicable.",
      "6. Never hedge on safety.",
    ].join("\n");

    const contextLine = data.scanContext
      ? `\nAdditional context from the user: ${data.scanContext}`
      : "";

    try {
      const { output } = await generateText({
        model: gateway("openai/gpt-4o"),
        output: Output.object({ schema: PhotoScanSchema }),
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `As The Oracle, scan this site photo with your full 30 years of expertise across all six fellowships.${contextLine}\n\nReturn a JSON report with: assessmentTitle (6–10 words capturing the key finding), summary (3–5 sentences covering what you see and its significance), keyFindings (array of specific observations, 3–6 items), regulatoryReferences (array of relevant UK regs, standards, and fellowship guidance), recommendations (array of actionable next steps, 2–5 items), riskFlags (array of any safety/quality/design risks identified), tradeInvolved (which trade is responsible if applicable), priority (low/medium/high/critical).`,
              },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });
      return { report: output };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const raw = error.text ?? "";
        let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start = cleaned.search(/[{[]/);
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.substring(start, end + 1);
        try {
          const parsed = PhotoScanSchema.parse(JSON.parse(cleaned));
          return { report: parsed };
        } catch {
          // fall through
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (error as any)?.message || "Oracle Scan failed.";
      throw new Error(msg);
    }
  });

