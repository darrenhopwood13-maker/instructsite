import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Enumerates every `.rpc("name", ...)` call site in the app source.
 * Guards against the generated-types / live-schema drift that let
 * `zone_runtime_progress` ship without ever being migrated.
 */
export function collectRpcCallSites(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const re = /\.rpc\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const name = m[1];
      const rel = file.slice(process.cwd().length + 1);
      const list = found.get(name) ?? [];
      if (!list.includes(rel)) list.push(rel);
      found.set(name, list);
    }
  }
  return found;
}

/**
 * Function names created (and not later dropped) by the migration history.
 * Replaces the old `public_function_names()` database helper, which was
 * executable by anonymous callers and leaked the internal API surface.
 */
export function collectMigratedFunctionNames(): Set<string> {
  const names = new Set<string>();
  if (!existsSync(MIGRATIONS)) return names;
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  const createRe = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(/gi;
  const dropRe = /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(/gi;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(sql))) names.add(m[1]);
    while ((m = dropRe.exec(sql))) names.delete(m[1]);
  }
  return names;
}

describe("RPC contract", () => {
  it("finds RPC call sites to check", () => {
    expect(collectRpcCallSites().size).toBeGreaterThan(0);
  });

  it("every RPC the app calls is defined in the migration history", () => {
    const existing = collectMigratedFunctionNames();
    if (existing.size === 0) return; // no migrations checked in locally
    const missing: string[] = [];
    for (const [name, files] of collectRpcCallSites()) {
      if (!existing.has(name)) missing.push(`${name} (called from ${files.join(", ")})`);
    }
    expect(missing, `Missing database functions:\n${missing.join("\n")}`).toEqual([]);
  });
});
