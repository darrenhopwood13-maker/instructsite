import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BibleDocument = {
  id: string; // site_document_id (or programme_upload id for programmes)
  source: "drawing" | "logistics" | "rams" | "programme" | "report";
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
          "id,created_at,site_documents(id,file_name,file_path,bucket,mime_type,file_size,created_at,extraction_status)",
        )
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of (rows ?? []) as any[]) {
        const sd: any = Array.isArray(row.site_documents)
          ? row.site_documents[0]
          : row.site_documents;
        if (!sd) continue;
        docs.push({
          id: sd.id,
          source: "logistics",
          title: sd.file_name,
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
          "id,trade_package,created_at,site_documents(id,file_name,file_path,bucket,mime_type,file_size,created_at,extraction_status)",
        )
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of (rows ?? []) as any[]) {
        const sd: any = Array.isArray(row.site_documents)
          ? row.site_documents[0]
          : row.site_documents;
        if (!sd) continue;
        docs.push({
          id: sd.id,
          source: "rams",
          title: row.trade_package || sd.file_name,
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

    // Filed reports (Oracle / Snag / Programme etc.)
    {
      const { data: rows, error } = await supabase
        .from("project_bible_reports")
        .select(
          "id,category,source,title,created_at,site_documents(id,file_name,file_path,bucket,mime_type,file_size,created_at,extraction_status)",
        )
        .eq("project_id", data.projectId);
      if (error) throw new Error(error.message);
      for (const row of (rows ?? []) as any[]) {
        const sd: any = Array.isArray(row.site_documents)
          ? row.site_documents[0]
          : row.site_documents;
        if (!sd) continue;
        docs.push({
          id: sd.id,
          source: "report",
          title: row.title || sd.file_name,
          category: `Report · ${row.category}`,
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

function slugForFilename(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "report"
  );
}

/**
 * File a generated report into the Project Bible.
 * Renders the markdown as a text-only PDF (Worker-safe, no headless browser),
 * stores it in the `project-bible` bucket, links it via `project_bible_reports`,
 * and fans out notifications to project managers/members.
 */
export const addReportToProjectBible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(200),
        category: z.enum(["Oracle", "Snag", "Programme", "Custom"]),
        markdown: z.string().min(1),
        source: z.string().max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureProjectMember(supabase, userId, data.projectId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { default: jsPDF } = await import("jspdf");

    // Build a simple, paginated text PDF.
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginX = 16;
    const marginY = 20;
    let y = marginY;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    const titleLines = pdf.splitTextToSize(data.title, pageW - marginX * 2);
    pdf.text(titleLines, marginX, y);
    y += titleLines.length * 7 + 2;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(
      `${data.category} · Filed ${new Date().toLocaleString()}`,
      marginX,
      y,
    );
    y += 8;
    pdf.setTextColor(0);

    const writeLine = (line: string, opts?: { bold?: boolean; size?: number }) => {
      const size = opts?.size ?? 11;
      pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      const wrapped = pdf.splitTextToSize(line, pageW - marginX * 2);
      for (const w of wrapped) {
        if (y > pageH - marginY) {
          pdf.addPage();
          y = marginY;
        }
        pdf.text(w, marginX, y);
        y += size * 0.42 + 1.2;
      }
    };

    for (const raw of data.markdown.split(/\r?\n/)) {
      const line = raw.replace(/[*_`]/g, "");
      if (/^##\s+/.test(raw)) {
        y += 3;
        writeLine(line.replace(/^##\s+/, ""), { bold: true, size: 13 });
      } else if (/^###\s+/.test(raw)) {
        writeLine(line.replace(/^###\s+/, ""), { bold: true, size: 11 });
      } else if (line.trim() === "") {
        y += 3;
      } else if (/^\s*[-*]\s+/.test(raw)) {
        writeLine(`• ${line.replace(/^\s*[-*]\s+/, "")}`);
      } else {
        writeLine(line);
      }
    }

    const pdfBytes = pdf.output("arraybuffer") as ArrayBuffer;
    const bytes = new Uint8Array(pdfBytes);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = slugForFilename(data.title);
    const fileName = `${stamp}-${slug}.pdf`;
    const storagePath = `bible-reports/${data.projectId}/${fileName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("project-bible")
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);

    // Insert site_documents row (service role: admin insert).
    const { data: sdRow, error: sdErr } = await supabaseAdmin
      .from("site_documents")
      .insert({
        file_name: fileName,
        file_path: storagePath,
        bucket: "project-bible",
        mime_type: "application/pdf",
        file_size: bytes.byteLength,
        uploaded_by: userId,
        extraction_status: "ready",
      })
      .select("id")
      .single();
    if (sdErr || !sdRow) throw new Error(sdErr?.message ?? "Failed to save document.");

    // Link into project_bible_reports (user-scoped via RLS).
    const { data: reportRow, error: linkErr } = await supabase
      .from("project_bible_reports")
      .insert({
        project_id: data.projectId,
        site_document_id: sdRow.id,
        category: data.category,
        source: data.source ?? null,
        title: data.title,
        created_by: userId,
      })
      .select("id")
      .single();
    if (linkErr || !reportRow) throw new Error(linkErr?.message ?? "Failed to link report.");

    // Fan out notifications to project managers/members (service role, ignore RLS).
    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("name,master_admin_id,project_admin_id,created_by")
      .eq("id", data.projectId)
      .maybeSingle();
    const { data: members } = await supabaseAdmin
      .from("project_members")
      .select("user_id")
      .eq("project_id", data.projectId);

    const recipientSet = new Set<string>();
    for (const m of members ?? []) if (m?.user_id) recipientSet.add(m.user_id);
    if (proj?.master_admin_id) recipientSet.add(proj.master_admin_id);
    if (proj?.project_admin_id) recipientSet.add(proj.project_admin_id);
    if (proj?.created_by) recipientSet.add(proj.created_by);
    recipientSet.delete(userId); // don't notify the creator

    if (recipientSet.size > 0) {
      const rows = Array.from(recipientSet).map((uid) => ({
        user_id: uid,
        project_id: data.projectId,
        kind: "report_added_to_bible",
        title: `New report in Project Bible${proj?.name ? ` · ${proj.name}` : ""}`,
        body: `${data.category}: ${data.title}`,
        link_to: `/projects/${data.projectId}/bible`,
      }));
      await supabaseAdmin.from("notifications").insert(rows);
    }

    return {
      documentId: sdRow.id,
      reportId: reportRow.id,
      filePath: storagePath,
    };
  });

