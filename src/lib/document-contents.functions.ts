import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials missing on server");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export const extractAndStoreDocumentText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = await getAdminClient();

    const { data: doc, error: docErr } = await supabase
      .from("site_documents")
      .select("id,file_name,file_path,bucket,mime_type")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("Document not found");

    const bucket = (doc.bucket as string) ?? "project-bible";
    const { data: blob, error: dlErr } = await supabase
      .storage
      .from(bucket)
      .download(doc.file_path as string);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? "Download failed");

    const mime = (doc.mime_type as string | null) ?? "";
    let content = "";
    if (mime.includes("pdf")) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      content = await extractPdfText(bytes);
    } else if (mime.startsWith("text/")) {
      content = await blob.text();
    } else {
      // Images / other: skip content extraction. Row still recorded so we know we tried.
      content = "";
    }

    const clean = content.replace(/\s+/g, " ").trim();
    const charCount = clean.length;

    const { error: upsertErr } = await supabase
      .from("document_contents")
      .upsert(
        {
          document_id: doc.id,
          content: clean,
          char_count: charCount,
          extracted_at: new Date().toISOString(),
        },
        { onConflict: "document_id" },
      );
    if (upsertErr) throw new Error(upsertErr.message);

    return { documentId: doc.id, charCount };
  });
