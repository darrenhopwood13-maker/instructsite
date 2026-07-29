import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SRC = join(process.cwd(), "src");

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

describe("RPC contract", () => {
  it("finds RPC call sites to check", () => {
    expect(collectRpcCallSites().size).toBeGreaterThan(0);
  });

  it.runIf(Boolean(url && key))(
    "every RPC the app calls exists in the database",
    async () => {
      const supabase = createClient(url!, key!, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabase.rpc("public_function_names");
      expect(error).toBeNull();
      const existing = new Set((data as string[]) ?? []);

      const missing: string[] = [];
      for (const [name, files] of collectRpcCallSites()) {
        if (!existing.has(name)) missing.push(`${name} (called from ${files.join(", ")})`);
      }
      expect(missing, `Missing database functions:\n${missing.join("\n")}`).toEqual([]);
    },
  );
});
