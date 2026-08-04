import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getProjectPhoto,
  setProjectPhoto,
  PROJECT_PHOTO_BUCKET,
} from "@/lib/project-photo.functions";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface Props {
  projectId: string;
  ready?: boolean;
}

export function ProjectPhotoPanel({ projectId, ready = true }: Props) {
  const getPhoto = useServerFn(getProjectPhoto);
  const savePhoto = useServerFn(setProjectPhoto);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photo = useQuery({
    queryKey: ["project-photo", projectId],
    queryFn: () => getPhoto({ data: { projectId } }),
    enabled: ready,
  });

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError("Use a JPG, PNG or WebP image.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image must be 10 MB or smaller.");
        return;
      }
      setBusy(true);
      try {
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${projectId}/cover-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PROJECT_PHOTO_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        await savePhoto({ data: { projectId, photoPath: path } });
        await photo.refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [photo, projectId, savePhoto],
  );

  const canManage = photo.data?.canManage === true;
  const url = photo.data?.photoUrl ?? null;

  return (
    <div
      className="glass-panel relative w-full overflow-hidden rounded-2xl border border-white/10 !p-0"
      data-tour="project-photo"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />

      {url ? (
        <div className="relative">
          <img
            src={url}
            alt="Project cover photograph"
            loading="lazy"
            className="block w-full object-cover"
            style={{ height: "13.5rem" }}
          />
          {canManage && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-background/80 px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground backdrop-blur hover:bg-background"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Replace
            </button>
          )}
        </div>
      ) : canManage ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={`flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition sm:h-52 md:h-[13.5rem] ${
            dragging ? "border-alert bg-alert/5" : "border-white/25 hover:border-white/40"
          }`}
        >
          {busy ? (
            <Loader2 size={20} className="animate-spin text-foreground/70" />
          ) : (
            <ImagePlus size={20} className="text-foreground/60" />
          )}
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/80">
            Add a project photo
          </p>
          <p className="text-[0.65rem] text-foreground/50">
            Drop a JPG, PNG or WebP here, or click to browse · max 10 MB
          </p>
        </div>
      ) : (
        <div className="flex h-44 w-full items-center justify-center px-4 text-center sm:h-52 md:h-[13.5rem]">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-foreground/40">
            No project photo
          </p>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 border-t border-white/10 px-3 py-2 text-[0.65rem] text-alert">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
