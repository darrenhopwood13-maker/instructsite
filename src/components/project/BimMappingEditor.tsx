import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Save, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  autoAllocateModelElements,
  getActiveIfcSignedUrl,
  listElementMappings,
  listModelElements,
  listProjectZones,
  saveModelElements,
  upsertElementMappings,
} from "@/lib/ifc-models.functions";
import { errorMessage } from "@/lib/error-message";

type ElementMeta = {
  globalId: string;
  expressId?: number | null;
  name: string | null;
  objectType: string | null;
  longName: string | null;
  storey: string | null;
  /** Real IFC entity name, e.g. IfcWallStandardCase */
  ifcType: string;
};

/** IfcWallStandardCase → "Wall Standard Case" */
function prettyType(t: string) {
  return t
    .replace(/^Ifc/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

export function BimMappingEditor({ projectId }: { projectId: string }) {
  const activeFn = useServerFn(getActiveIfcSignedUrl);
  const mapFn = useServerFn(listElementMappings);
  const zonesFn = useServerFn(listProjectZones);
  const saveFn = useServerFn(upsertElementMappings);
  const autoFn = useServerFn(autoAllocateModelElements);
  const catalogueFn = useServerFn(listModelElements);
  const persistFn = useServerFn(saveModelElements);
  const qc = useQueryClient();

  const activeQ = useQuery({
    queryKey: ["ifc-active", projectId],
    queryFn: () => activeFn({ data: { projectId } }),
  });
  const mapQ = useQuery({
    queryKey: ["ifc-mappings", projectId],
    queryFn: () => mapFn({ data: { projectId } }),
  });
  const zonesQ = useQuery({
    queryKey: ["project-zones", projectId],
    queryFn: () => zonesFn({ data: { projectId } }),
  });
  const catalogueQ = useQuery({
    queryKey: ["ifc-elements", projectId],
    queryFn: () => catalogueFn({ data: { projectId } }),
  });

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Stored catalogue is the source of truth for labels.
  const elements: ElementMeta[] = useMemo(
    () =>
      (catalogueQ.data ?? []).map((r: any) => ({
        globalId: r.global_id,
        expressId: r.express_id,
        name: r.name,
        objectType: r.object_type,
        longName: r.long_name,
        storey: r.storey,
        ifcType: r.ifc_type ?? "IfcBuildingElement",
      })),
    [catalogueQ.data],
  );

  // Seed assignments from server on load
  useEffect(() => {
    if (!mapQ.data) return;
    const seed: Record<string, string> = {};
    for (const r of mapQ.data) seed[r.global_id] = r.zone_id;
    setAssignments((prev) => ({ ...seed, ...prev }));
  }, [mapQ.data]);

  const runRandallAutoAllocate = async () => {
    if (elements.length === 0) {
      toast.error("Scan the model first so Randall has elements to sort");
      return;
    }
    setAutoRunning(true);
    try {
      const payload = elements.map((el) => ({
        globalId: el.globalId,
        text: [el.name, el.objectType, el.longName, el.storey, prettyType(el.ifcType)]
          .filter(Boolean)
          .join(" | "),
        ifcType: el.ifcType ?? "",
      }));
      const res = await autoFn({ data: { projectId, elements: payload } });
      if (!res.ok) {
        toast.error("Randall couldn't allocate", { description: res.reason });
      } else if (res.count === 0) {
        toast.warning("Randall allocated nothing", {
          description: res.reason,
          duration: 12_000,
        });
      } else {
        const c = (res as any).confidence;
        const detail = c ? ` · ${c.hard} hard · ${c.strong} strong · ${c.weak} weak` : "";
        toast.success(`Randall auto-allocated ${res.count} elements${detail}`, {
          description: res.reason,
        });
        qc.invalidateQueries({ queryKey: ["ifc-mappings", projectId] });
      }
    } catch (e) {
      toast.error("Auto-allocate failed", { description: errorMessage(e) });
    } finally {
      setAutoRunning(false);
    }
  };

  const scanModel = async () => {
    if (!activeQ.data?.url || !activeQ.data.model) {
      toast.error("No active IFC model");
      return;
    }
    setScanning(true);
    try {
      const { getWebIfcApi, loadModelBuffer } = await import("@/lib/ifc-loader");
      const { WebIFC, api } = await getWebIfcApi();
      const buf = await loadModelBuffer(activeQ.data.model.id, activeQ.data.url);
      const modelID = api.OpenModel(buf, {});

      // --- storey lookup: element expressID → storey name ---
      const storeyByElement = new Map<number, string>();
      try {
        const storeyName = new Map<number, string>();
        const storeys = api.GetLineIDsWithType(modelID, WebIFC.IFCBUILDINGSTOREY);
        for (let i = 0; i < storeys.size(); i++) {
          const sid = storeys.get(i);
          const line = api.GetLine(modelID, sid);
          storeyName.set(
            sid,
            line?.Name?.value ? String(line.Name.value) : `Level ${i + 1}`,
          );
        }
        const rels = api.GetLineIDsWithType(
          modelID,
          WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
        );
        for (let i = 0; i < rels.size(); i++) {
          const rel = api.GetLine(modelID, rels.get(i));
          const structure = rel?.RelatingStructure?.value;
          const label = storeyName.get(structure);
          if (!label) continue;
          for (const el of rel?.RelatedElements ?? []) {
            if (el?.value != null) storeyByElement.set(el.value, label);
          }
        }
      } catch {
        /* storey data is a nicety, never a blocker */
      }

      // --- element sweep across the real IFC entity types ---
      const candidateTypes: string[] = [
        "IFCWALL",
        "IFCWALLSTANDARDCASE",
        "IFCSLAB",
        "IFCCOLUMN",
        "IFCBEAM",
        "IFCMEMBER",
        "IFCPLATE",
        "IFCFOOTING",
        "IFCPILE",
        "IFCDOOR",
        "IFCWINDOW",
        "IFCROOF",
        "IFCSTAIR",
        "IFCSTAIRFLIGHT",
        "IFCRAILING",
        "IFCCOVERING",
        "IFCCURTAINWALL",
        "IFCRAMP",
        "IFCSPACE",
        "IFCFURNISHINGELEMENT",
        "IFCFLOWSEGMENT",
        "IFCFLOWTERMINAL",
        "IFCFLOWFITTING",
        "IFCBUILDINGELEMENTPROXY",
      ];

      const found: ElementMeta[] = [];
      const seen = new Set<string>();
      for (const key of candidateTypes) {
        const typeCode = (WebIFC as any)[key];
        if (!typeCode) continue;
        // "IFCWALLSTANDARDCASE" → "IfcWallStandardCase"
        const entityName =
          "Ifc" +
          key
            .slice(3)
            .toLowerCase()
            .replace(/(^|[^a-z])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
        let lines: any;
        try {
          lines = api.GetLineIDsWithType(modelID, typeCode);
        } catch {
          continue;
        }
        for (let i = 0; i < lines.size(); i++) {
          const eid = lines.get(i);
          try {
            const line = api.GetLine(modelID, eid);
            const gid = line?.GlobalId?.value ? String(line.GlobalId.value) : null;
            if (!gid || seen.has(gid)) continue;
            seen.add(gid);
            found.push({
              globalId: gid,
              expressId: eid,
              name: line?.Name?.value ? String(line.Name.value) : null,
              objectType: line?.ObjectType?.value ? String(line.ObjectType.value) : null,
              longName: line?.LongName?.value ? String(line.LongName.value) : null,
              storey: storeyByElement.get(eid) ?? null,
              ifcType: entityName,
            });
          } catch {
            /* skip unreadable line */
          }
        }
      }
      api.CloseModel(modelID);

      if (found.length === 0) {
        toast.warning("No IFC building elements found in this model");
        return;
      }

      await persistFn({ data: { modelId: activeQ.data.model.id, elements: found } });
      await catalogueQ.refetch();
      toast.success(`Catalogued ${found.length} IFC elements with type, name and storey`);
    } catch (e) {
      toast.error("Scan failed", { description: errorMessage(e) });
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!activeQ.data?.model) return;
    setSaving(true);
    try {
      const rows = Object.entries(assignments)
        .filter(([, zone_id]) => !!zone_id)
        .map(([global_id, zone_id]) => ({ global_id, zone_id }));
      await saveFn({ data: { modelId: activeQ.data.model.id, rows } });
      toast.success(`Saved ${rows.length} mappings`);
      qc.invalidateQueries({ queryKey: ["ifc-mappings", projectId] });
    } catch (e) {
      toast.error("Save failed", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const allRows = useMemo(() => {
    const byId = new Map<string, ElementMeta>();
    for (const el of elements) byId.set(el.globalId, el);
    // Mapped elements that predate the catalogue still need a row.
    for (const gid of Object.keys(assignments)) {
      if (!byId.has(gid)) {
        byId.set(gid, {
          globalId: gid,
          name: null,
          objectType: null,
          longName: null,
          storey: null,
          ifcType: "IfcBuildingElement",
        });
      }
    }
    return Array.from(byId.values());
  }, [elements, assignments]);

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const el of allRows) counts.set(el.ifcType, (counts.get(el.ifcType) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allRows]);

  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((el) => {
      if (typeFilter && el.ifcType !== typeFilter) return false;
      if (!q) return true;
      return [el.name, el.objectType, el.longName, el.storey, prettyType(el.ifcType), el.globalId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allRows, search, typeFilter]);

  const staleCatalogue = allRows.length > 0 && elements.length === 0;

  if (!activeQ.data?.model) {
    return (
      <div className="glass-panel p-4 text-xs text-foreground/60">
        Upload an IFC model to enable mapping.
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          <Link2 size={12} /> Element ↔ Zone Mapping
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={scanModel}
            disabled={scanning}
            className="rounded-md border border-white/15 px-3 py-1.5 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert disabled:opacity-50"
          >
            {scanning ? (
              <>
                <Loader2 size={10} className="mr-1 inline animate-spin" /> Scanning
              </>
            ) : elements.length > 0 ? (
              "Re-scan Model"
            ) : (
              "Scan Model"
            )}
          </button>
          <button
            type="button"
            onClick={runRandallAutoAllocate}
            disabled={autoRunning || elements.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-alert bg-alert/15 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-alert transition hover:bg-alert/25 disabled:cursor-not-allowed disabled:opacity-40"
            title="Randall groups elements into build zones by IFC type and name"
          >
            {autoRunning ? (
              <>
                <Loader2 size={10} className="animate-spin" /> Randall thinking…
              </>
            ) : (
              <>
                <Sparkles size={12} /> Let Randall Auto-Allocate
              </>
            )}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-foreground/80 hover:border-alert hover:text-alert disabled:opacity-50"
          >
            <Save size={10} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {autoRunning && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
          <Loader2 size={14} className="animate-spin" />
          Randall is reading element types and names and grouping them into build zones…
        </div>
      )}

      {staleCatalogue && (
        <p className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[0.7rem] text-amber-200">
          These mappings were made before element details were stored. Run{" "}
          <strong>Scan Model</strong> to pull the real IFC types, names and storeys.
        </p>
      )}

      {allRows.length === 0 ? (
        <p className="mt-3 text-xs text-foreground/50">
          Click <strong>Scan Model</strong> to catalogue the model's IFC elements, then assign each
          to a work zone.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search
                size={12}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, type, storey or ID…"
                className="w-full rounded-md border border-white/15 bg-black/40 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-foreground/35 focus:border-alert focus:outline-none"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-foreground focus:border-alert focus:outline-none"
            >
              <option value="">All entity types ({allRows.length})</option>
              {typeOptions.map(([t, n]) => (
                <option key={t} value={t}>
                  {prettyType(t)} ({n})
                </option>
              ))}
            </select>
            <span className="font-mono text-[0.6rem] uppercase tracking-widest text-foreground/45">
              {displayRows.length} shown
            </span>
          </div>

          <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-white/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background/95 text-[0.6rem] uppercase tracking-widest text-foreground/50">
                <tr>
                  <th className="px-3 py-2 text-left">Element</th>
                  <th className="w-48 px-3 py-2 text-left">Work Zone</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-foreground/50">
                      No elements match that search or filter.
                    </td>
                  </tr>
                )}
                {displayRows.map((el) => (
                  <tr key={el.globalId} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-sm border border-alert/40 bg-alert/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-alert">
                          {prettyType(el.ifcType)}
                        </span>
                        <span className="truncate font-bold text-foreground">
                          {el.name ?? el.longName ?? `Unnamed ${prettyType(el.ifcType)}`}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[0.65rem] text-foreground/60">
                        {[el.storey, el.objectType].filter(Boolean).join(" · ") || "No storey data"}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.55rem] text-foreground/35">
                        {el.globalId.slice(0, 10)}…
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={assignments[el.globalId] ?? ""}
                        onChange={(e) =>
                          setAssignments((a) => ({ ...a, [el.globalId]: e.target.value }))
                        }
                        className="w-full rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-xs text-foreground focus:border-alert focus:outline-none"
                      >
                        <option value="">— unmapped —</option>
                        {(zonesQ.data ?? []).map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                            {z.level ? ` · ${z.level}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
