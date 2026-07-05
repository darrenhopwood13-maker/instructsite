import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Loader2, AlertTriangle } from "lucide-react";
import * as THREE from "three";
import {
  getActiveIfcSignedUrl,
  listElementMappings,
  listZoneRuntimeState,
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
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [pulseT, setPulseT] = useState(0);
  const qc = useQueryClient();

  const activeFn = useServerFn(getActiveIfcSignedUrl);
  const mapFn = useServerFn(listElementMappings);
  const stateFn = useServerFn(listZoneRuntimeState);

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

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(50, 100, 50);
    scene.add(ambient, dir);

    const grid = new THREE.GridHelper(200, 40, 0x333344, 0x1c1c26);
    scene.add(grid);

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

