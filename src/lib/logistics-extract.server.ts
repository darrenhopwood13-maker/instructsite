/**
 * Server-only helpers for extracting work zones from a site logistics plan.
 * Handles both text-based PDFs and raster images (PNG/JPEG/HEIC) — the latter
 * via a multimodal read so image plans no longer dead-end in "processing".
 */

export type ExtractedZone = { name: string; level?: string | null; description?: string | null };

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

import { ZONE_NAME_RULE } from "./zone-normalise";

const ZONE_PROMPT =
  'Extract the work zones / site areas / compounds / levels marked on this Site Logistics Plan. ' +
  'Return JSON: { "zones": [{ "name": string, "level": string|null, "description": string|null }] }. ' +
  ZONE_NAME_RULE +
  " Only include zones that are actually labelled on the plan. Never invent zones.";

async function gateway() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  return createLovableAiGatewayProvider(apiKey);
}

function parseZones(text: string): ExtractedZone[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  let obj: any;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The plan reader did not return usable zone data.");
    obj = JSON.parse(m[0]);
  }
  const zones = Array.isArray(obj?.zones) ? obj.zones : [];
  return zones
    .map((z: any) => ({
      name: String(z?.name ?? "").trim(),
      level: z?.level ? String(z.level).trim() : null,
      description: z?.description ? String(z.description).trim() : null,
    }))
    .filter((z: ExtractedZone) => !!z.name);
}

/**
 * Downloads the source document and returns the work zones it describes.
 * Throws with a human-readable message when nothing can be read.
 */
export async function extractLogisticsZones(
  supabase: any,
  siteDocumentId: string,
): Promise<ExtractedZone[]> {
  const { data: doc, error } = await supabase
    .from("site_documents")
    .select("file_path,bucket,mime_type,file_name")
    .eq("id", siteDocumentId)
    .maybeSingle();
  if (error || !doc) throw new Error("Source plan document is missing.");

  const { data: blob, error: dlErr } = await supabase.storage
    .from(doc.bucket ?? "project-bible")
    .download(doc.file_path);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not download the plan file.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = (doc.mime_type ?? "").toLowerCase();
  const { generateText } = await import("ai");
  const gw = await gateway();

  // Raster plans (and scanned PDFs) go through a multimodal read.
  const isImage = mime.startsWith("image/");
  if (!isImage) {
    let rawText = "";
    try {
      if (mime.includes("pdf")) {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        rawText = Array.isArray(text) ? text.join("\n") : text;
      } else if (mime.startsWith("text/")) {
        rawText = new TextDecoder().decode(bytes);
      }
    } catch {
      rawText = "";
    }
    if (rawText.trim().length >= 20) {
      const { text } = await generateText({
        model: gw("google/gemini-2.5-flash"),
        system: "You extract construction site data. Respond ONLY with valid JSON.",
        prompt: `${ZONE_PROMPT}\n\n---PLAN TEXT---\n${rawText.slice(0, 12000)}`,
      });
      return parseZones(text);
    }
  }

  // Vision path — works for PNG/JPEG plans and text-less (scanned) PDFs.
  const dataUrl = `data:${mime || (isImage ? "image/png" : "application/pdf")};base64,${bytesToBase64(bytes)}`;
  const { text } = await generateText({
    model: gw("google/gemini-2.5-pro"),
    system: "You read construction site logistics plans. Respond ONLY with valid JSON.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: ZONE_PROMPT },
          isImage
            ? { type: "image", image: dataUrl }
            : {
                type: "file",
                data: dataUrl,
                mediaType: mime || "application/pdf",
                filename: doc.file_name ?? "logistics.pdf",
              },
        ] as any,
      },
    ],
  });
  return parseZones(text);
}
