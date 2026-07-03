import { useCallback, useState } from "react";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractAndStoreDocumentText } from "@/lib/document-contents.functions";

type UploadItem = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

const BUCKET = "project-bible";
const ACCEPT = "application/pdf,image/*";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectBibleUpload() {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const extractText = useServerFn(extractAndStoreDocumentText);


  const uploadFile = useCallback(async (file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [
      { id, name: file.name, size: file.size, status: "uploading" },
      ...prev,
    ]);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? "anonymous";
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: inserted, error: dbErr } = await supabase
        .from("site_documents")
        .insert({
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          bucket: BUCKET,
          uploaded_by: userData?.user?.id ?? null,
        })
        .select("id")
        .single();
      if (dbErr) throw dbErr;

      // Fire-and-forget text extraction; failures don't block upload UI
      if (inserted?.id) {
        void extractText({ data: { documentId: inserted.id as string } }).catch(
          (err) => console.warn("Text extraction failed", err),
        );
      }

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "done" } : i)),
      );

    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "error", error: message } : i)),
      );
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((f) => void uploadFile(f));
    },
    [uploadFile],
  );

  return (
    <section className="mt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-alert">
        Project Bible
      </p>
      <h2
        className="mt-2 text-3xl font-extrabold uppercase tracking-tight text-foreground"
        style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
      >
        Site Documents
      </h2>
      <p className="mt-2 max-w-xl text-foreground/70">
        Drop drawings, RAMS, method statements, and site photos. PDFs and images.
      </p>

      <label
        htmlFor="project-bible-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`glass-panel mt-6 flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-alert bg-alert/5" : "border-white/15"
        }`}
      >
        <div className="glass-accent flex h-14 w-14 items-center justify-center">
          <UploadCloud size={26} />
        </div>
        <div className="font-display text-lg font-bold text-foreground">
          Drop files here, or click to browse
        </div>
        <div className="text-sm text-foreground/60">PDF, PNG, JPG · up to your Supabase bucket limit</div>
        <input
          id="project-bible-input"
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="glass-panel flex items-center gap-3 p-3">
              <div className="glass-accent flex h-9 w-9 items-center justify-center">
                <FileText size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                <div className="text-xs text-foreground/60">
                  {formatSize(item.size)}
                  {item.status === "error" && item.error ? ` · ${item.error}` : ""}
                </div>
              </div>
              {item.status === "uploading" && <Loader2 size={18} className="animate-spin text-foreground/70" />}
              {item.status === "done" && <CheckCircle2 size={18} className="text-emerald-400" />}
              {item.status === "error" && <AlertCircle size={18} className="text-alert" />}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                className="text-foreground/50 hover:text-foreground"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ProjectBibleUpload;
