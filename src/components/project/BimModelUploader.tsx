import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerIfcModel } from "@/lib/ifc-models.functions";

export function BimModelUploader({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const registerFn = useServerFn(registerIfcModel);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".ifc")) {
      toast.error("File must be a .ifc model");
      return;
    }
    setBusy(true);
    try {
      const path = `${projectId}/${crypto.randomUUID()}.ifc`;
      const { error: upErr } = await supabase.storage
        .from("project-bim-models")
        .upload(path, file, { contentType: "application/octet-stream", upsert: false });
      if (upErr) throw upErr;
      await registerFn({
        data: { projectId, storagePath: path, filename: file.name },
      });
      toast.success("IFC model uploaded", { description: file.name });
      qc.invalidateQueries({ queryKey: ["ifc-active", projectId] });
      qc.invalidateQueries({ queryKey: ["ifc-mappings", projectId] });
    } catch (e: any) {
      toast.error("Upload failed", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="glass-panel p-4">
      <h3 className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
        <Upload size={12} /> Upload IFC Model
      </h3>
      <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
        Uploading a new file replaces the currently active model.
      </p>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-alert/40 bg-alert/5 px-4 py-6 text-xs uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert">
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <Upload size={14} /> Choose .ifc file
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".ifc"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
    </div>
  );
}
