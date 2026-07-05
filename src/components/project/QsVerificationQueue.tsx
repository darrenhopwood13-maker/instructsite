import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  listQsQueue,
  setDiaryQsStatus,
  signDiaryPhotos,
} from "@/lib/daily-diary.functions";

type DiaryRow = {
  id: string;
  trade_package: string | null;
  operative_count: number | null;
  hours_logged: number | null;
  progress_status: string | null;
  completion_pct: number | null;
  notes: string | null;
  qs_status: string | null;
  photo_urls: string[] | null;
  work_zones?: { name?: string | null; level?: string | null } | null;
};

function DiaryPhotoGrid({
  paths,
  onOpen,
}: {
  paths: string[];
  onOpen: (url: string, index: number) => void;
}) {
  const signFn = useServerFn(signDiaryPhotos);
  const key = useMemo(() => paths.join("|"), [paths]);
  const q = useQuery({
    queryKey: ["diary-photo-signed", key],
    queryFn: () => signFn({ data: { paths } }),
    enabled: paths.length > 0,
    staleTime: 55 * 60 * 1000,
  });

  if (paths.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
      {(q.data ?? paths.map((p) => ({ path: p, url: null }))).map(
        (item, i) => (
          <button
            key={item.path + i}
            type="button"
            onClick={() => item.url && onOpen(item.url, i)}
            disabled={!item.url}
            className="group relative aspect-square overflow-hidden rounded-sm border border-white/15 bg-black/50 transition hover:border-alert focus:outline-none focus:ring-2 focus:ring-alert disabled:opacity-40"
          >
            {item.url ? (
              <img
                src={item.url}
                alt={`Diary evidence ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-foreground/40">
                <ImageIcon size={14} />
              </div>
            )}
          </button>
        ),
      )}
    </div>
  );
}

function PhotoLightbox({
  urls,
  index,
  onClose,
  onNav,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onNav: (next: number) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav((index + 1) % urls.length);
      if (e.key === "ArrowLeft") onNav((index - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, urls.length, onClose, onNav]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/60 p-2 text-white hover:border-alert hover:text-alert"
        aria-label="Close"
      >
        <X size={18} />
      </button>
      <img
        src={urls[index]}
        alt={`Diary evidence ${index + 1}`}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-white/80">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}

export function QsVerificationQueue({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listQsQueue);
  const setStatusFn = useServerFn(setDiaryQsStatus);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const q = useQuery({
    queryKey: ["qs-queue", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const decide = async (diaryId: string, status: "approved" | "rejected") => {
    try {
      await setStatusFn({ data: { diaryId, status } });
      toast.success(status === "approved" ? "Approved — pushed to IFC." : "Rejected.");
      qc.invalidateQueries({ queryKey: ["qs-queue", projectId] });
      qc.invalidateQueries({ queryKey: ["zone-completion", projectId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update diary.");
    }
  };

  const rows = (q.data ?? []) as DiaryRow[];
  const pending = rows.filter((r) => r.qs_status === "pending");
  const decided = rows.filter((r) => r.qs_status !== "pending").slice(0, 8);

  return (
    <div>
      <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
        QS Verification Queue
      </h2>
      <p className="mt-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
        Unverified valuation claims from today's checkouts
      </p>
      <ul className="mt-3 space-y-2">
        {pending.map((r) => {
          const photos = r.photo_urls ?? [];
          return (
            <li key={r.id} className="glass-panel border-l-4 border-l-alert p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {r.trade_package ?? "Untagged"} · {r.operative_count} ops ·{" "}
                    {r.hours_logged}h
                  </p>
                  <p className="mt-0.5 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                    {r.work_zones?.name ?? "no zone"}
                    {r.work_zones?.level ? ` · ${r.work_zones.level}` : ""} · Status:{" "}
                    <span className="text-alert">{r.progress_status}</span> · Completion{" "}
                    <span className="text-alert">{r.completion_pct}%</span>
                  </p>
                  {r.notes && (
                    <p className="mt-2 rounded-sm border border-white/10 bg-black/30 p-2 text-xs italic text-foreground/70">
                      "{r.notes}"
                    </p>
                  )}
                  {photos.length > 0 && (
                    <>
                      <p className="mt-2 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                        <ImageIcon size={10} /> {photos.length} photo
                        {photos.length > 1 ? "s" : ""} — click to inspect
                      </p>
                      <DiaryPhotoGrid
                        paths={photos}
                        onOpen={(_url, index) => {
                          // rebuild the full url list from cache result
                          const cache = qc.getQueryData<
                            Array<{ path: string; url: string | null }>
                          >(["diary-photo-signed", photos.join("|")]);
                          const urls = (cache ?? [])
                            .map((c) => c.url)
                            .filter((u): u is string => !!u);
                          if (urls.length > 0) setLightbox({ urls, index });
                        }}
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => decide(r.id, "approved")}
                    className="inline-flex items-center gap-1 rounded-md border-2 border-green-500 bg-green-500/10 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-widest text-green-400 hover:bg-green-500/20"
                  >
                    <CheckCircle2 size={12} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(r.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1.5 text-[0.6rem] uppercase tracking-widest text-foreground/60 hover:border-red-500 hover:text-red-400"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {pending.length === 0 && (
          <li className="glass-panel p-4 text-center text-xs text-foreground/50">
            No pending diaries.
          </li>
        )}
      </ul>

      {decided.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[0.6rem] uppercase tracking-widest text-foreground/50 hover:text-foreground">
            Recently decided ({decided.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-sm border border-white/10 bg-black/20 px-2 py-1.5 text-[0.65rem] text-foreground/70"
              >
                <span className="truncate">
                  {r.trade_package ?? "Untagged"} · {r.completion_pct}%
                </span>
                <span
                  className={`font-mono uppercase tracking-widest ${
                    r.qs_status === "approved" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {r.qs_status}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {lightbox && (
        <PhotoLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNav={(next) => setLightbox({ ...lightbox, index: next })}
        />
      )}
    </div>
  );
}
