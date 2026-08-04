/**
 * TEMPORARY demo-setup harness. Delete after the Kingsgate House build.
 *
 * Invokes real server functions server-side while carrying the caller's own
 * Supabase bearer token, so every step runs through the genuine
 * requireSupabaseAuth + RLS path rather than raw SQL.
 *
 * Guarded by the x-kg-key header.
 */
import { createFileRoute } from "@tanstack/react-router";

import * as projects from "@/lib/projects.functions";
import * as subs from "@/lib/subcontractors.functions";
import * as tier1 from "@/lib/tier1-uploads.functions";
import * as programme from "@/lib/programme.functions";
import * as bible from "@/lib/project-bible.functions";
import * as profiles from "@/lib/profiles.functions";
import * as stp from "@/lib/short-term-programme.functions";

const REGISTRY: Record<string, Record<string, unknown>> = {
  projects,
  subs,
  tier1,
  programme,
  bible,
  profiles,
  stp,
};

const HARNESS_KEY = "kingsgate-demo-2026";

export const Route = createFileRoute("/api/public/kg-harness-tmp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-kg-key") !== HARNESS_KEY) {
          return new Response("forbidden", { status: 403 });
        }
        const body = (await request.json()) as {
          mod: string;
          fn: string;
          data?: unknown;
        };
        const mod = REGISTRY[body.mod];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = mod?.[body.fn] as any;
        if (typeof fn !== "function") {
          return Response.json(
            { ok: false, error: `Unknown function ${body.mod}.${body.fn}` },
            { status: 400 },
          );
        }
        try {
          const result =
            body.data === undefined ? await fn() : await fn({ data: body.data });
          return Response.json({ ok: true, result });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error)?.message ?? String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
