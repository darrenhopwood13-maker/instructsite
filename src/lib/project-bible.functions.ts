import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BibleDocument = {
  id: string; // site_document_id (or programme_upload id for programmes)
  source: "drawing" | "logistics" | "rams" | "programme";
  title: string;
  category: string;
  fileName: string;
  mimeType: string | null;
  bucket: string;
  filePath: string;
  sizeBytes: number | null;
  uploadedAt: string | null;
  extractionStatus: string | null;
};

async function ensureProjectMember(
  supabase: any,
  userId: string,
  projectId: string,
) {
  const { data, error } = await supabase.rpc("is_project_member", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You don't have access to this project.");
}

export const listProjectBibleDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<BibleDocument[]> => {
    const { supabase, userId } = context;
    await ensureProjectMember(supabase, userId, data.projectId);

    const docs: BibleDocument[] = [];

    // Drawings
    {
      const { data: rows, error } = await supabase
        .from("project_drawings")
        .select(
          "id,title,drawing_no,revision,created_at,site_documents(id,file_name,file_path,bucket,mime_type,file_size,created_at,extraction_status)",
        )
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        const sd: any = Array.isArray(row.site_documents)
          ? row.site_documents[0]
          : row.site_documents;
        if (!sd) continue;
        const title =
          [row.drawing_no, row.revision ? `Rev ${row.revision}` : null, row.title]
            .filter(Boolean)
            .join(" · ") || sd.file_name;
        docs.push({
          id: sd.id,
          source: "drawing",
          title,
          category: "Drawings",
          fileName: sd.file_name,
          mimeType: sd.mime_type,
          bucket: sd.bucket ?? "project-bible",
          filePath: sd.file_path,
          sizeBytes: sd.file_size ?? null,
          uploadedAt: sd.created_at ?? row.created_at ?? null,
          extractionStatus: sd.extraction_status ?? null,
        });
      }
    }

    // Logistics
    {
      const { data: rows, error } = await supabase
        .from("logistics_plans")
        .select(
          "id,title,created_at,site_documents(id,file_name,file_path,bucket,mime_type,file_size,created_at,extraction_status)",
        )
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        const sd: any = Array.isArray(row.site_documents)
          ? row.site_documents[0]
          : row.site_documents;
        if (!sd) continue;
        docs.push({
          id: sd.id,
          source: "logistics",
          title: row.title || sd.file_name,
          category: "Logistics",
          fileName: sd.file_name,
          mimeType: sd.mime_type,
          bucket: sd.bucket ?? "project-bible",
          filePath: sd.file_path,
          sizeBytes: sd.file_size ?? null,
          uploadedAt: sd.created_at ?? row.created_at ?? null,
          extractionStatus: sd.extraction_status ?? null,
        });
      }
    }

    // RAMS
    {
      const { data: rows, error } = await supabase
        .from("rams_documents")
        .select(
          "id,title,created_at,site_documents(id,file_name,file_path,bucket,mime_type,file_size,created_at,extraction_status)",
        )
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        const sd: any = Array.isArray(row.site_documents)
          ? row.site_documents[0]
          : row.site_documents;
        if (!sd) continue;
        docs.push({
          id: sd.id,
          source: "rams",
          title: row.title || sd.file_name,
          category: "RAMS",
          fileName: sd.file_name,
          mimeType: sd.mime_type,
          bucket: sd.bucket ?? "project-bible",
          filePath: sd.file_path,
          sizeBytes: sd.file_size ?? null,
          uploadedAt: sd.created_at ?? row.created_at ?? null,
          extractionStatus: sd.extraction_status ?? null,
        });
      }
    }

    // Programme uploads
    {
      const { data: rows, error } = await supabase
        .from("programme_uploads")
        .select("id,file_name,mime_type,storage_path,created_at,status")
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of rows ?? []) {
        if (!row.storage_path) continue;
        docs.push({
          id: row.id,
          source: "programme",
          title: row.file_name,
          category: "Programme",
          fileName: row.file_name,
          mimeType: row.mime_type,
          bucket: "programme-uploads",
          filePath: row.storage_path,
          sizeBytes: null,
          uploadedAt: row.created_at,
          extractionStatus: row.status ?? null,
        });
      }
    }

    // Dedupe by (bucket + filePath), keep first occurrence
    const seen = new Set<string>();
    const unique = docs.filter((d) => {
      const key = `${d.bucket}::${d.filePath}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
    return unique;
  });

export const getBibleDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        bucket: z.string().min(1),
        filePath: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectMember(supabase, userId, data.projectId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.filePath, 60 * 60);
    if (error) throw new Error(error.message);
    return { signedUrl: signed?.signedUrl ?? null };
  });
