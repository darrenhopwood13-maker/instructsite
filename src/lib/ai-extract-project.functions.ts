import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  dataBase64: z.string().min(1),
});

const Extracted = z.object({
  projectName: z.string(),
  siteAddress: z.string(),
  clientName: z.string(),
  mainContractor: z.string(),
  projectBrief: z.string(),
});

export const extractProjectFromDrawing = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const isPdf = /pdf/i.test(data.mimeType);
    const isImage = /^image\//i.test(data.mimeType);
    if (!isPdf && !isImage) {
      throw new Error("Unsupported file type. Upload a PDF drawing or a title-block image.");
    }

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: string; mediaType: string; filename?: string }
      | { type: "image"; image: string }
    > = [
      {
        type: "text",
        text:
          "You are the InstructBrain Oracle. Analyse this construction General Arrangement (GA) drawing pack. Read every title block, revision block, and cover sheet. Extract these fields as plain strings. If a value is truly not present, return an empty string for that field — never invent. Fields: projectName, siteAddress (full postal address), clientName (aka end user / employer), mainContractor (principal contractor), projectBrief (1–3 sentences summarising scope / building type / phase from what the drawing shows).",
      },
    ];
    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;
    if (isPdf) {
      userContent.push({
        type: "file",
        data: dataUrl,
        mediaType: data.mimeType,
        filename: data.fileName,
      });
    } else {
      userContent.push({ type: "image", image: dataUrl });
    }

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-pro"),
        output: Output.object({ schema: Extracted }),
        messages: [{ role: "user", content: userContent }],
      });

      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        // Fallback: try to salvage JSON from the raw text
        try {
          const parsed = JSON.parse(error.text ?? "{}");
          return Extracted.parse(parsed);
        } catch {
          // fall through
        }
      }
      throw error;
    }
  });
