/**
 * Shared web-ifc runtime for the whole app.
 *
 * - Single WASM/API init per browser session (module-level Promise cache).
 * - Model buffers are cached in IndexedDB, keyed on the model id (stable,
 *   independent of signed-URL rotation), and in a module-level in-memory
 *   promise map so simultaneous callers (Viewer + Mapping Editor) share
 *   one fetch.
 */

let apiPromise: Promise<{ WebIFC: any; api: any }> | null = null;

export async function getWebIfcApi(): Promise<{ WebIFC: any; api: any }> {
  if (apiPromise) return apiPromise;
  apiPromise = (async () => {
    const WebIFC: any = await import("web-ifc");
    const api = new WebIFC.IfcAPI();
    api.SetWasmPath("/wasm/");
    await api.Init();
    return { WebIFC, api };
  })();
  return apiPromise;
}

const bufferPromises = new Map<string, Promise<Uint8Array>>();

const IDB_NAME = "instructsite-ifc-cache";
const IDB_STORE = "buffers";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  try {
    const db = await openIdb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(v instanceof Uint8Array ? v : v ? new Uint8Array(v as ArrayBuffer) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbPut(key: string, buf: Uint8Array): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const req = tx.objectStore(IDB_STORE).put(buf, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    /* best-effort */
  }
}

export async function loadModelBuffer(
  modelId: string,
  url: string,
): Promise<Uint8Array> {
  const existing = bufferPromises.get(modelId);
  if (existing) return existing;
  const p = (async () => {
    const cached = await idbGet(modelId);
    if (cached && cached.byteLength > 0) return cached;
    const resp = await fetch(url, { cache: "force-cache" });
    const buf = new Uint8Array(await resp.arrayBuffer());
    void idbPut(modelId, buf);
    return buf;
  })();
  bufferPromises.set(modelId, p);
  try {
    return await p;
  } catch (e) {
    bufferPromises.delete(modelId);
    throw e;
  }
}
