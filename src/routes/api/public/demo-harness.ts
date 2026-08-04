/**
 * TEMPORARY demo-build harness (Kingsgate House). Delete after the demo.
 *
 * Runs real server functions under the caller's own bearer token so every
 * action goes through the same middleware + RLS path the UI uses.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/demo-harness")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { action: string; args?: any };
        const t = await import("@/lib/tier1-uploads.functions");
        const p = await import("@/lib/programme.functions");
        try {
          let result: unknown;
          switch (body.action) {
            case "retryLogistics":
              result = await t.retryLogisticsExtraction({ data: body.args });
              break;
            case "allocateZones":
              result = await t.allocateZonesForDabsDrawing({ data: body.args });
              break;
            case "enqueueProgramme":
              result = await p.enqueueProgrammeJob({ data: body.args });
              break;
            case "programmeJob":
              result = await p.getProgrammeJob({ data: body.args });
              break;
            default:
              return new Response("unknown action", { status: 400 });
          }
          return Response.json({ ok: true, result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
