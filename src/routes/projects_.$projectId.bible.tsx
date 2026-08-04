import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Search, Loader2, Archive } from "lucide-react";
import { getProject, getMyRoles } from "@/lib/projects.functions";
import {
  listProjectBibleDocuments,
  searchProjectBible,
  type BibleDocument,
} from "@/lib/project-bible.functions";
import { archiveDocument, restoreDocument } from "@/lib/document-lifecycle.functions";
import { ensureOracleSession } from "@/lib/ensure-oracle-session";
import { DocumentCard } from "@/components/project-bible/DocumentCard";
import { DocumentViewerDialog } from "@/components/project-bible/DocumentViewerDialog";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/projects_/$projectId/bible")({
  head: () => ({ meta: [{ title: "Project Bible — instructSite" }] }),
  component: ProjectBiblePage,
});

function ProjectBiblePage() {
  const { projectId } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureOracleSession().then(() => setReady(true));
  }, []);

  const getP = useServerFn(getProject);
  const listFn = useServerFn(listProjectBibleDocuments);
  const rolesFn = useServerFn(getMyRoles);
  const archiveFn = useServerFn(archiveDocument);
  const restoreFn = useServerFn(restoreDocument);
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getP({ data: { projectId } }),
    enabled: ready,
  });

  const rolesQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    enabled: ready,
    staleTime: 60_000,
  });
  const canArchive =
    !!rolesQ.data?.roles?.includes("master_admin") ||
    !!rolesQ.data?.roles?.includes("project_admin") ||
    !!rolesQ.data?.roles?.includes("site_manager");

  const docsQ = useQuery({
    queryKey: ["project-bible", projectId, showArchived],
    queryFn: () => listFn({ data: { projectId, includeArchived: showArchived } }),
    enabled: ready,
  });

  const archiveM = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { siteDocumentId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-bible", projectId] });
      toast.success("Document archived.");
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't archive that document.")),
  });
  const restoreM = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { siteDocumentId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-bible", projectId] });
      toast.success("Document restored.");
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't restore that document.")),
  });

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<BibleDocument | null>(null);

  const searchFn = useServerFn(searchProjectBible);
  const searchQ = useQuery({
    queryKey: ["bible-search", projectId, debounced],
    queryFn: () => searchFn({ data: { projectId, query: debounced } }),
    enabled: ready && debounced.length >= 3,
    staleTime: 30_000,
  });
  const searchHits = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of searchQ.data ?? []) m.set(r.documentId, r.snippet);
    return m;
  }, [searchQ.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (docsQ.data ?? []).forEach((d) => set.add(d.category));
    return ["all", ...Array.from(set)];
  }, [docsQ.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (docsQ.data ?? []).filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (!q) return true;
      if (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q)
      )
        return true;
      // Full-text hit against extracted content
      return searchHits.has(d.id);
    });
  }, [docsQ.data, query, category, searchHits]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-3 py-1.5 text-xs uppercase tracking-widest text-foreground/80 hover:border-border hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Project
            </Link>
          </div>
          <div className="text-right">
            <h1 className="flex items-center justify-end gap-2 text-2xl font-bold text-foreground">
              <BookOpen className="h-6 w-6 text-primary" /> Project Bible
            </h1>
            <p className="text-sm text-muted-foreground">
              {projectQ.data?.name ?? "Project"} · every document uploaded to
              this project
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              data-tour="bible-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full rounded-md border border-border/60 bg-background/60 px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" data-tour="bible-filters">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition ${
                  category === c
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition ${
              showArchived
                ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                : "border-border/60 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Archive className="h-3 w-3" /> {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>

        {docsQ.isLoading && (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading project
            documents…
          </div>
        )}
        {docsQ.isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {(docsQ.error as Error)?.message ?? "Failed to load documents."}
          </div>
        )}
        {!docsQ.isLoading && !docsQ.isError && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-foreground">
              No documents match your filters
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload drawings, logistics, RAMS or a programme from the project
              page.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((doc) => {
            const snippet = searchHits.get(doc.id);
            return (
              <div key={`${doc.source}-${doc.id}`} className="flex flex-col gap-1">
                <DocumentCard
                  doc={doc}
                  projectId={projectId}
                  onView={() => setSelected(doc)}
                  canArchive={canArchive}
                  onArchive={() => archiveM.mutate(doc.id)}
                  onRestore={() => restoreM.mutate(doc.id)}
                />
                {snippet && (
                  <p className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] italic text-foreground/70">
                    …{snippet}…
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <DocumentViewerDialog
          doc={selected}
          projectId={projectId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
