import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ExtractionStatus = "pending" | "processing" | "complete" | "empty" | "failed";

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractImageText(bytes: Uint8Array, mimeType: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return "";

  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  const { text } = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all readable construction-document text from this image. Return only the extracted text. If no readable text is present, return an empty response.",
          },
          { type: "image", image: bytes, mediaType: mimeType },
        ],
      },
    ],
  } as Parameters<typeof generateText>[0]);

  return text;
}

async function extractContent(blob: Blob, mimeType: string): Promise<string> {
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf")) {
    return extractPdfText(new Uint8Array(await blob.arrayBuffer()));
  }
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml")) {
    return blob.text();
  }
  if (mime.startsWith("image/")) {
    return extractImageText(new Uint8Array(await blob.arrayBuffer()), mimeType);
  }
  return "";
}

function cleanExtractedText(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

async function updateExtractionRows(
  supabase: any,
  documentId: string,
  status: ExtractionStatus,
  content: string,
  error?: string,
) {
  const clean = cleanExtractedText(content);
  const charCount = clean.length;
  const now = new Date().toISOString();

  const { error: contentErr } = await supabase.from("document_contents").upsert(
    {
      document_id: documentId,
      content: clean,
      char_count: charCount,
      extraction_status: status,
      extraction_error: error ?? null,
      extracted_at: now,
    },
    { onConflict: "document_id" },
  );
  if (contentErr) throw new Error(contentErr.message);

  const { error: docErr } = await supabase
    .from("site_documents")
    .update({ extraction_status: status, extraction_error: error ?? null })
    .eq("id", documentId);
  if (docErr) throw new Error(docErr.message);

  return { charCount };
}

async function extractAndStoreByDocumentId(supabase: any, documentId: string) {
  const { data: doc, error: docErr } = await supabase
    .from("site_documents")
    .select("id,file_name,file_path,bucket,mime_type")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr) throw new Error(docErr.message);
  if (!doc) throw new Error("Document not found");

  await supabase
    .from("site_documents")
    .update({ extraction_status: "processing", extraction_error: null })
    .eq("id", documentId);

  const bucket = doc.bucket ?? "project-bible";
  const { data: blob, error: dlErr } = await supabase.storage
    .from(bucket)
    .download(doc.file_path);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "Download failed");

  const content = await extractContent(blob, doc.mime_type ?? "");
  const clean = cleanExtractedText(content);
  const status: ExtractionStatus = clean.length > 0 ? "complete" : "empty";
  const { charCount } = await updateExtractionRows(supabase, documentId, status, clean);

  return { documentId, charCount, extractionStatus: status };
}

const uploadedDocumentInput = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().nonnegative(),
  mimeType: z.string().min(1),
  bucket: z.string().min(1).default("project-bible"),
});

export const registerAndExtractUploadedDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadedDocumentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.filePath.startsWith(`${userId}/`)) {
      throw new Error("Upload path does not match the signed-in user.");
    }

    const { data: doc, error: insertErr } = await supabase
      .from("site_documents")
      .insert({
        file_name: data.fileName,
        file_path: data.filePath,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        bucket: data.bucket,
        uploaded_by: userId,
        extraction_status: "processing",
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(insertErr.message);

    try {
      return await extractAndStoreByDocumentId(supabase, doc.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Text extraction failed";
      await updateExtractionRows(supabase, doc.id, "failed", "", message);
      return {
        documentId: doc.id,
        charCount: 0,
        extractionStatus: "failed" as const,
        error: message,
      };
    }
  });

export const extractAndStoreDocumentText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      return await extractAndStoreByDocumentId(context.supabase, data.documentId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Text extraction failed";
      await updateExtractionRows(context.supabase, data.documentId, "failed", "", message);
      return {
        documentId: data.documentId,
        charCount: 0,
        extractionStatus: "failed" as const,
        error: message,
      };
    }
  });
