import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Loader2, AlertTriangle, Link2, Focus, X } from "lucide-react";
import { toast } from "sonner";
import * as THREE from "three";
import {
  getActiveIfcSignedUrl,
  listElementMappings,
  listProjectZones,
  listZoneRuntimeState,
  upsertElementMappings,
} from "@/lib/ifc-models.functions";


type ZoneState = "unstarted" | "live" | "complete";

interface MeshEntry {
  mesh: THREE.Mesh;
  baseMaterial: THREE.MeshStandardMaterial;
  globalId: string;
  expressID: number;
  ifcType: string;
  properties: Record<string, string | number | null>;
}

const COLORS: Record<ZoneState, THREE.Color> = {
  unstarted: new THREE.Color("#7a7a7a"),
  live: new THREE.Color("#ff7a00"),
  complete: new THREE.Color("#22c55e"),
};

const HIGHLIGHT_COLOR = new THREE.Color("#ffffff");

async function loadIfcMeshes(
  url: string,
  scene: THREE.Scene,
): Promise<{ meshes: MeshEntry[]; box: THREE.Box3 }> {
  const WebIFC: any = await import("web-ifc");
  const ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath("/wasm/");
  await ifcApi.Init();

  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const modelID: number = ifcApi.OpenModel(buf, { COORDINATE_TO_ORIGIN: true });

  const meshes: MeshEntry[] = [];
  const box = new THREE.Box3();

  ifcApi.StreamAllMeshes(modelID, (flatMesh: any) => {
    const expressID = flatMesh.expressID;
    let globalId = String(expressID);
    let ifcType = "IFCELEMENT";
    const properties: Record<string, string | number | null> = {};
    try {
      const line = ifcApi.GetLine(modelID, expressID);
      if (line) {
        if (line.GlobalId?.value) globalId = String(line.GlobalId.value);
        if (line.constructor?.name) ifcType = line.constructor.name;
        else if (line.type) ifcType = String(line.type);
        for (const [k, v] of Object.entries(line)) {
          if (k === "expressID" || k === "type") continue;
          if (v && typeof v === "object" && "value" in (v as any)) {
            const val = (v as any).value;
            if (val !== null && val !== undefined && typeof val !== "object") {
              properties[k] = val as string | number;
            }
          } else if (typeof v === "string" || typeof v === "number") {
            properties[k] = v;
          }
        }
      }
    } catch {
      /* keep expressID fallback */
    }

    const placedGeoms = flatMesh.geometries;
    const geomCount = placedGeoms.size();
    for (let i = 0; i < geomCount; i++) {
      const placed = placedGeoms.get(i);
      const geom = ifcApi.GetGeometry(modelID, placed.geometryExpressID);
      const verts = ifcApi.GetVertexArray(
        geom.GetVertexData(),
        geom.GetVertexDataSize(),
      ) as Float32Array;
      const idx = ifcApi.GetIndexArray(
        geom.GetIndexData(),
        geom.GetIndexDataSize(),
      ) as Uint32Array;

      // web-ifc verts interleave [x,y,z, nx,ny,nz] × N
      const positions = new Float32Array(verts.length / 2);
      const normals = new Float32Array(verts.length / 2);
      for (let v = 0, p = 0; v < verts.length; v += 6, p += 3) {
        positions[p] = verts[v];
        positions[p + 1] = verts[v + 1];
        positions[p + 2] = verts[v + 2];
        normals[p] = verts[v + 3];
        normals[p + 1] = verts[v + 4];
        normals[p + 2] = verts[v + 5];
      }
      const bufferGeom = new THREE.BufferGeometry();
      bufferGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      bufferGeom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      bufferGeom.setIndex(new THREE.BufferAttribute(idx, 1));

      const color = placed.color;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color.x, color.y, color.z),
        opacity: color.w,
        transparent: color.w < 1,
        side: THREE.DoubleSide,
        metalness: 0.05,
        roughness: 0.75,
      });

      const matrix = new THREE.Matrix4().fromArray(placed.flatTransformation as number[]);
      const mesh = new THREE.Mesh(bufferGeom, mat);
      mesh.applyMatrix4(matrix);
      mesh.userData.globalId = globalId;
      mesh.userData.expressID = expressID;
      scene.add(mesh);
      box.expandByObject(mesh);
      meshes.push({ mesh, baseMaterial: mat, globalId, expressID, ifcType, properties });
      geom.delete?.();
    }
  });



  ifcApi.CloseModel(modelID);
  return { meshes, box };
}

export function BimModelViewer({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const meshesRef = useRef<MeshEntry[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const selectedRef = useRef<MeshEntry | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [pulseT, setPulseT] = useState(0);
  const [isolatedZoneId, setIsolatedZoneId] = useState<string>("");
  const [selected, setSelected] = useState<{
    globalId: string;
    expressID: number;
    ifcType: string;
    properties: Record<string, string | number | null>;
  } | null>(null);
  const qc = useQueryClient();

  const activeFn = useServerFn(getActiveIfcSignedUrl);
  const mapFn = useServerFn(listElementMappings);
  const stateFn = useServerFn(listZoneRuntimeState);
  const zonesFn = useServerFn(listProjectZones);
  const saveFn = useServerFn(upsertElementMappings);
  const [assignZone, setAssignZone] = useState<string>("");
  const [locking, setLocking] = useState(false);

  const activeQ = useQuery({
    queryKey: ["ifc-active", projectId],
    queryFn: () => activeFn({ data: { projectId } }),
  });
  const mapQ = useQuery({
    queryKey: ["ifc-mappings", projectId],
    queryFn: () => mapFn({ data: { projectId } }),
  });
  const stateQ = useQuery({
    queryKey: ["zone-runtime", projectId],
    queryFn: () => stateFn({ data: { projectId } }),
    refetchInterval: 10_000,
  });
  const zonesQ = useQuery({
    queryKey: ["project-zones", projectId],
    queryFn: () => zonesFn({ data: { projectId } }),
  });


  // Init three + load IFC when signed URL arrives
  useEffect(() => {
    if (!activeQ.data) return;
    if (!activeQ.data.url) {
      setStatus("empty");
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    setStatus("loading");
    setError(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a0f");

    const width = container.clientWidth;
    const height = container.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 5000);
    camera.position.set(30, 25, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(50, 100, 50);
    scene.add(ambient, dir);

    const grid = new THREE.GridHelper(200, 40, 0x333344, 0x1c1c26);
    scene.add(grid);

    // ---- Raycasting: click-to-inspect ----
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      // Ignore drags (orbit control moves)
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const meshList = meshesRef.current.map((m) => m.mesh);
      const hits = raycaster.intersectObjects(meshList, false);
      if (hits.length === 0) {
        // Clear selection
        if (selectedRef.current) {
          selectedRef.current.baseMaterial.emissive.setHex(0x000000);
          selectedRef.current = null;
        }
        setSelected(null);
        return;
      }
      const hitMesh = hits[0].object as THREE.Mesh;
      const entry = meshesRef.current.find((m) => m.mesh === hitMesh);
      if (!entry) return;
      // Clear previous highlight
      if (selectedRef.current && selectedRef.current !== entry) {
        selectedRef.current.baseMaterial.emissive.setHex(0x000000);
      }
      selectedRef.current = entry;
      entry.baseMaterial.emissive.copy(HIGHLIGHT_COLOR);
      entry.baseMaterial.emissiveIntensity = 0.55;
      entry.baseMaterial.needsUpdate = true;
      setSelected({
        globalId: entry.globalId,
        expressID: entry.expressID,
        ifcType: entry.ifcType,
        properties: entry.properties,
      });
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);


    let disposed = false;
    let controls: any = null;

    (async () => {
      try {
        const { OrbitControls } = await import(
          "three/examples/jsm/controls/OrbitControls.js"
        );
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controlsRef.current = controls;

        const { meshes, box } = await loadIfcMeshes(activeQ.data.url!, scene);
        if (disposed) return;
        meshesRef.current = meshes;

        // Center camera on model
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          camera.position.copy(center).add(new THREE.Vector3(maxDim, maxDim * 0.8, maxDim));
          controls.target.copy(center);
          controls.update();
        }

        setStatus("ready");
      } catch (e: any) {
        console.error("[BIM] IFC load failed", e);
        setError(e?.message ?? "Failed to load IFC model");
        setStatus("error");
      }
    })();

    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      setPulseT(t);
      controls?.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 520;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      controls?.dispose?.();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      meshesRef.current.forEach((m) => {
        m.mesh.geometry.dispose();
        m.baseMaterial.dispose();
      });
      meshesRef.current = [];
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      selectedRef.current = null;
    };
  }, [activeQ.data]);

  // Recolour meshes when mappings / state / pulse changes
  useEffect(() => {
    const meshes = meshesRef.current;
    if (meshes.length === 0) return;
    const mappings = mapQ.data ?? [];
    const stateByZone = new Map<string, ZoneState>();
    for (const s of stateQ.data ?? []) stateByZone.set(s.zone_id, s.state);
    const stateByGid = new Map<string, ZoneState>();
    for (const m of mappings) {
      const zs = stateByZone.get(m.zone_id) ?? "unstarted";
      stateByGid.set(m.global_id, zs);
    }

    const pulse = 0.5 + 0.5 * Math.sin(pulseT * 3);

    for (const entry of meshes) {
      const zs = stateByGid.get(entry.globalId);
      if (!zs) {
        // Unmapped mesh = keep original IFC color, dim it
        entry.baseMaterial.transparent = true;
        entry.baseMaterial.opacity = 0.25;
        entry.baseMaterial.emissive.setHex(0x000000);
        continue;
      }
      const color = COLORS[zs];
      entry.baseMaterial.color.copy(color);
      if (zs === "unstarted") {
        entry.baseMaterial.transparent = true;
        entry.baseMaterial.opacity = 0.4;
        entry.baseMaterial.emissive.setHex(0x000000);
      } else if (zs === "live") {
        entry.baseMaterial.transparent = false;
        entry.baseMaterial.opacity = 1;
        entry.baseMaterial.emissive.copy(color);
        entry.baseMaterial.emissiveIntensity = 0.35 + pulse * 0.55;
      } else {
        entry.baseMaterial.transparent = false;
        entry.baseMaterial.opacity = 1;
        entry.baseMaterial.emissive.copy(color);
        entry.baseMaterial.emissiveIntensity = 0.25;
      }
      entry.baseMaterial.needsUpdate = true;
    }
  }, [mapQ.data, stateQ.data, pulseT]);

  // Give parent a way to refresh (invoked from realtime elsewhere)
  useEffect(() => {
    (window as any).__bimRefresh = () => {
      qc.invalidateQueries({ queryKey: ["zone-runtime", projectId] });
      qc.invalidateQueries({ queryKey: ["ifc-mappings", projectId] });
    };
    return () => {
      delete (window as any).__bimRefresh;
    };
  }, [projectId, qc]);

  const zoneProgress = (stateQ.data ?? []).slice().sort((a, b) => {
    // complete → live → unstarted, then desc by progress
    const rank: Record<string, number> = { complete: 0, live: 1, unstarted: 2 };
    const r = rank[a.state] - rank[b.state];
    return r !== 0 ? r : (b.progress_pct ?? 0) - (a.progress_pct ?? 0);
  });

  // Human-readable label derivation from raw IFC attributes
  const humanLabel = useMemo(() => {
    if (!selected) return null;
    const p = selected.properties;
    const pick = (k: string) => {
      const v = p[k];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const name = pick("Name");
    const objectType = pick("ObjectType");
    const longName = pick("LongName");
    const tag = pick("Tag");
    const prettyType = selected.ifcType
      .replace(/^Ifc/i, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    const primary = name || longName || prettyType;
    const secondary = objectType || (name && longName && longName !== name ? longName : null) || tag;
    return { primary, secondary, prettyType };
  }, [selected]);

  // Existing mapping for selected element
  const existingZoneId = useMemo(() => {
    if (!selected) return "";
    const found = (mapQ.data ?? []).find((r) => r.global_id === selected.globalId);
    return found?.zone_id ?? "";
  }, [selected, mapQ.data]);

  useEffect(() => {
    setAssignZone(existingZoneId);
  }, [existingZoneId, selected?.globalId]);

  const lockToZone = async () => {
    if (!selected || !activeQ.data?.model || !assignZone) return;
    setLocking(true);
    try {
      await saveFn({
        data: {
          modelId: activeQ.data.model.id,
          rows: [{ global_id: selected.globalId, zone_id: assignZone }],
        },
      });
      const zoneName = (zonesQ.data ?? []).find((z) => z.id === assignZone)?.name ?? "zone";
      toast.success(`Locked ${humanLabel?.primary ?? "element"} → ${zoneName}`);
      qc.invalidateQueries({ queryKey: ["ifc-mappings", projectId] });
    } catch (e: any) {
      toast.error("Lock failed", { description: e?.message ?? String(e) });
    } finally {
      setLocking(false);
    }
  };


  return (
    <div className="glass-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.35em] text-alert">
          <Box size={12} /> BIM · Live IFC Model
        </h2>
        <div className="flex items-center gap-3 text-[0.6rem] uppercase tracking-widest text-foreground/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#7a7a7a]" /> Unstarted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff7a00]" /> Live
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Complete
          </span>
        </div>
      </div>

      <div className="relative" style={{ height: 520 }}>
        <div ref={containerRef} className="absolute inset-0" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <Loader2 className="animate-spin" size={16} /> Parsing IFC geometry…
            </div>
          </div>
        )}
        {status === "empty" && (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <Box className="mx-auto mb-2 text-foreground/40" size={28} />
              <p className="text-sm text-foreground/70">
                No active IFC model. Upload one below.
              </p>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/40 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-2 text-red-400" size={28} />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* BIM Element Property Inspector — slide-out */}
        <div
          className={`absolute right-0 top-0 h-full w-80 max-w-[85%] transform border-l border-white/15 bg-black/95 backdrop-blur-md transition-transform duration-300 ${
            selected ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {selected && (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[0.55rem] font-bold uppercase tracking-[0.35em] text-alert">
                    Selected · {humanLabel?.prettyType ?? "Element"}
                  </p>
                  <h3 className="mt-1 truncate text-base font-extrabold leading-tight text-foreground">
                    {humanLabel?.primary ?? "Unnamed element"}
                  </h3>
                  {humanLabel?.secondary && (
                    <p className="mt-0.5 truncate text-xs text-foreground/70">
                      {humanLabel.secondary}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRef.current) {
                      selectedRef.current.baseMaterial.emissive.setHex(0x000000);
                      selectedRef.current = null;
                    }
                    setSelected(null);
                  }}
                  className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-[0.6rem] uppercase tracking-widest text-foreground/70 hover:border-white/40"
                >
                  Close
                </button>
              </div>

              {/* Zone assignment — primary action */}
              <div className="border-b border-white/10 bg-black/40 px-4 py-3">
                <p className="mb-1.5 text-[0.55rem] font-bold uppercase tracking-[0.35em] text-foreground/60">
                  Assign to Work Zone
                </p>
                <select
                  value={assignZone}
                  onChange={(e) => setAssignZone(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-background px-2 py-2 text-xs text-foreground focus:border-alert focus:outline-none"
                >
                  <option value="">— unmapped —</option>
                  {(zonesQ.data ?? []).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                      {z.level ? ` · ${z.level}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={lockToZone}
                  disabled={!assignZone || locking || assignZone === existingZoneId}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-alert bg-alert/15 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-widest text-alert transition hover:bg-alert/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {locking ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Link2 size={12} />
                  )}
                  {existingZoneId
                    ? assignZone === existingZoneId
                      ? "Locked"
                      : "Re-lock to Zone"
                    : "Lock Element to Zone"}
                </button>
                {existingZoneId && assignZone === existingZoneId && (
                  <p className="mt-1.5 text-[0.6rem] text-emerald-400/80">
                    ✓ Currently mapped to{" "}
                    {(zonesQ.data ?? []).find((z) => z.id === existingZoneId)?.name}
                  </p>
                )}
              </div>

              {/* Technical details — collapsed / muted */}
              <details className="border-b border-white/10 px-4 py-2 text-[0.6rem]">
                <summary className="cursor-pointer font-mono uppercase tracking-widest text-foreground/40 hover:text-foreground/70">
                  Technical IDs
                </summary>
                <div className="mt-2 space-y-1 font-mono text-foreground/50">
                  <p>IFC Type: <span className="text-foreground/70">{selected.ifcType}</span></p>
                  <p className="truncate">GlobalId: <span className="text-foreground/70">{selected.globalId}</span></p>
                  <p>Express #: <span className="text-foreground/70">{selected.expressID}</span></p>
                </div>
              </details>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="mb-2 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                  Attributes
                </p>
                <table className="w-full text-left">
                  <tbody>
                    {Object.entries(selected.properties).length === 0 && (
                      <tr>
                        <td className="py-2 text-xs text-foreground/50">
                          No inline attributes on this entity.
                        </td>
                      </tr>
                    )}
                    {Object.entries(selected.properties).map(([k, v]) => (
                      <tr key={k} className="border-b border-white/5">
                        <td className="py-1.5 pr-3 font-mono text-[0.6rem] uppercase tracking-widest text-foreground/50">
                          {k}
                        </td>
                        <td className="py-1.5 font-mono text-[0.65rem] text-foreground/90">
                          {String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-white/10 px-4 py-2 text-[0.55rem] uppercase tracking-widest text-foreground/40">
                Click any 3D element to inspect · Click empty space to clear
              </div>
            </div>
          )}
        </div>
      </div>

      {zoneProgress.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-foreground/50">
            Cumulative approved progress
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {zoneProgress.map((z) => {
              const barColor =
                z.state === "complete"
                  ? "bg-[#22c55e]"
                  : z.state === "live"
                    ? "bg-[#ff7a00]"
                    : "bg-[#7a7a7a]";
              return (
                <div
                  key={z.zone_id}
                  className="flex items-center gap-2 rounded-md border border-white/5 bg-black/30 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground/80">
                      {z.name}
                      {z.level ? (
                        <span className="text-foreground/40"> · {z.level}</span>
                      ) : null}
                    </p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${z.progress_pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-9 text-right font-mono text-[0.7rem] text-foreground/70">
                    {z.progress_pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

