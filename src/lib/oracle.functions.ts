import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const COMMAND_PROMPTS: Record<string, { title: string; system: string }> = {
  installation: {
    title: "Installation Sequence",
    system:
      "You are a site operations engineer. Produce a clear, numbered installation and commissioning sequence for a typical industrial equipment install. Include safety checkpoints and hand-off criteria. Keep it concise and practical.",
  },
  safety: {
    title: "Safety Auditor",
    system:
      "You are a construction/industrial safety auditor. Produce a RAMS-style risk assessment: hazards, likelihood/severity, mitigations, PPE, and compliance references. Be concise and structured.",
  },
  procurement: {
    title: "Procurement",
    system:
      "You are a procurement specialist. Draft a Bill of Materials outline with representative categories, typical vendors, and expected lead times for a mid-scale site installation. Note any long-lead items.",
  },
  drawing: {
    title: "Drawing Q&A",
    system:
      "You are a technical drawings assistant. Explain how to interrogate a construction/engineering drawing set: what to look for, common annotations, revision control, and typical questions site teams raise.",
  },
  snag: {
    title: "Snag Master",
    system:
      "You are a snagging/defect specialist. Produce a compact snag-capture checklist covering common defect categories, severity grading, and a tracking workflow to closeout.",
  },
  assist: {
    title: "AI Assist",
    system:
      "You are an on-site knowledge co-pilot. Introduce the top ways an AI assistant helps a site engineer during a working day, with concrete example prompts and outputs.",
  },
};

export const runOracleCommand = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const prompt = COMMAND_PROMPTS[data.key];
    if (!prompt) {
      throw new Error(`Unknown Oracle command: ${data.key}`);
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { text } = await generateText({
      model,
      system: prompt.system,
      prompt: `Provide the ${prompt.title} briefing now. Use markdown headings and bullet points where helpful.`,
    });

    return { title: prompt.title, answer: text };
  });
