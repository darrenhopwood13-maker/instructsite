import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getActiveIfcSignedUrl,
  listElementMappings,
  listProjectZones,
  upsertElementMappings,
} from "@/lib/ifc-models.functions";

export function BimMappingEditor({ projectId }: { projectId: string }) {
  const activeFn = useServerFn(getActiveIfcSignedUrl);
  const mapFn = useServerFn(listElementMappings);
  const zonesFn = useServerFn(listProjectZones);
  const saveFn = useServerFn(upsertElementMappings);
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

  type ElementMeta = {
    globalId: string;
    name: string;
    objectType: string | null;
    longName: string | null;
    ifcType: string;
  };
  const [elements, setElements] = useState<ElementMeta[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed assignments from server on load
  useEffect(() => {
    if (!mapQ.data) return;
    const seed: Record<string, string> = {};
    for (const r of mapQ.data) seed[r.global_id] = r.zone_id;
    setAssignments((prev) => ({ ...seed, ...prev }));
  }, [mapQ.data]);

  const scanModel = async () => {
    if (!activeQ.data?.url) {
      toast.error("No active IFC model");
      return;
    }
    setScanning(true);
    try {
      const WebIFC: any = await import("web-ifc");
      const api = new WebIFC.IfcAPI();
      api.SetWasmPath("/wasm/");
      await api.Init();
      const buf = new Uint8Array(await (await fetch(activeQ.data.url)).arrayBuffer());
      const modelID = api.OpenModel(buf, {});
      const found: ElementMeta[] = [];
      const typeMap: Array<[number, string]> = [
        [WebIFC.IFCWALL, "Wall"],
        [WebIFC.IFCWALLSTANDARDCASE, "Wall"],
        [WebIFC.IFCSLAB, "Slab"],
        [WebIFC.IFCCOLUMN, "Column"],
        [WebIFC.IFCBEAM, "Beam"],
        [WebIFC.IFCDOOR, "Door"],
        [WebIFC.IFCWINDOW, "Window"],
        [WebIFC.IFCROOF, "Roof"],
        [WebIFC.IFCSTAIR, "Stair"],
        [WebIFC.IFCSPACE, "Space"],
        [WebIFC.IFCBUILDINGELEMENTPROXY, "Element"],
      ].filter(([t]) => !!t) as Array<[number, string]>;
      const seen = new Set<string>();
      for (const [t, pretty] of typeMap) {
        const lines = api.GetLineIDsWithType(modelID, t);
        for (let i = 0; i < lines.size(); i++) {
          const eid = lines.get(i);
          try {
            const line = api.GetLine(modelID, eid);
            const gid = line?.GlobalId?.value ? String(line.GlobalId.value) : null;
            if (!gid || seen.has(gid)) continue;
            seen.add(gid);
            found.push({
              globalId: gid,
              name: line?.Name?.value ? String(line.Name.value) : `Unnamed ${pretty}`,
              objectType: line?.ObjectType?.value ? String(line.ObjectType.value) : null,
              longName: line?.LongName?.value ? String(line.LongName.value) : null,
              ifcType: pretty,
            });
          } catch {
            /* skip */
          }
        }
      }
      api.CloseModel(modelID);
      setElements(found);
      toast.success(`Discovered ${found.length} IFC elements`);
    } catch (e: any) {
      toast.error("Scan failed", { description: e?.message ?? String(e) });
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
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  const displayRows = useMemo(() => {
    const byId = new Map<string, ElementMeta>();
    for (const el of elements) byId.set(el.globalId, el);
    // Include any server-mapped elements not in the scan (unknown label fallback)
    for (const gid of Object.keys(assignments)) {
      if (!byId.has(gid)) {
        byId.set(gid, {
          globalId: gid,
          name: "Mapped element",
          objectType: null,
          longName: null,
          ifcType: "Element",
        });
      }
    }
    return Array.from(byId.values());
  }, [elements, assignments]);

  if (!activeQ.data?.model) {
    return (
      <div className="glass-panel p-4 text-xs text-foreground/60">
        Upload an IFC model to enable mapping.
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          <Link2 size={12} /> Element ↔ Zone Mapping
        </h3>
        <div className="flex gap-2">
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
            ) : (
              "Scan Model"
            )}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-alert bg-alert/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-alert hover:bg-alert/20 disabled:opacity-50"
          >
            <Save size={10} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {displayRows.length === 0 ? (
        <p className="mt-3 text-xs text-foreground/50">
          Click <strong>Scan Model</strong> to discover structural elements, then assign each to a
          work zone.
        </p>
      ) : (
        <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-white/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background/95 text-[0.6rem] uppercase tracking-widest text-foreground/50">
              <tr>
                <th className="px-3 py-2 text-left">Element</th>
                <th className="w-48 px-3 py-2 text-left">Work Zone</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((el) => (
                <tr key={el.globalId} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <div className="font-bold text-foreground">{el.name}</div>
                    {(el.objectType || el.longName) && (
                      <div className="mt-0.5 text-[0.65rem] text-foreground/70">
                        {el.objectType ?? el.longName}
                      </div>
                    )}
                    <div className="mt-0.5 text-[0.55rem] uppercase tracking-widest text-foreground/40">
                      {el.ifcType} · <span className="font-mono normal-case tracking-normal">{el.globalId.slice(0, 8)}…</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={assignments[el.globalId] ?? ""}
                      onChange={(e) =>
                        setAssignments((a) => ({ ...a, [el.globalId]: e.target.value }))
                      }
                      className="w-full rounded-sm border border-white/10 bg-background px-2 py-1 text-xs text-foreground"
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

      )}
    </div>
  );
}
