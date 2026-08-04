/**
 * TEMPORARY test harness — delete after the overnight STP test run.
 * Invokes real server functions in-process so the Supabase auth middleware
 * sees the caller's own bearer token. Guarded by a shared secret header.
 */
import { createFileRoute } from "@tanstack/react-router";
import * as stp from "@/lib/short-term-programme.functions";
import * as priv from "@/lib/private-programme.functions";

const REGISTRY: Record<string, (args: any) => Promise<any>> = {
  listShortTermProgrammes: stp.listShortTermProgrammes as any,
  getShortTermProgramme: stp.getShortTermProgramme as any,
  createShortTermProgrammeFromUpload: stp.createShortTermProgrammeFromUpload as any,
  saveShortTermProgrammeTasks: stp.saveShortTermProgrammeTasks as any,
  sendShortTermProgrammeForApproval: stp.sendShortTermProgrammeForApproval as any,
  acceptShortTermProgramme: stp.acceptShortTermProgramme as any,
  setShortTermTaskStatus: stp.setShortTermTaskStatus as any,
  addShortTermAnnotation: stp.addShortTermAnnotation as any,
  deleteShortTermProgramme: stp.deleteShortTermProgramme as any,
  listPrivateProgrammes: priv.listPrivateProgrammes as any,
  getPrivateProgramme: priv.getPrivateProgramme as any,
  createPrivateProgramme: priv.createPrivateProgramme as any,
  savePrivateProgramme: priv.savePrivateProgramme as any,
  deletePrivateProgramme: priv.deletePrivateProgramme as any,
};

export const Route = createFileRoute("/api/public/__stp-harness")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-harness-secret") !== "1ad8f3978984323c61ceeeb7e3a2722d") {
          return new Response("forbidden", { status: 403 });
        }
        const body = (await request.json()) as { fn: string; data?: unknown };
        const fn = REGISTRY[body.fn];
        if (!fn) return new Response(`unknown fn ${body.fn}`, { status: 400 });
        try {
          const result = await fn({ data: body.data ?? {} });
          return Response.json({ ok: true, result });
        } catch (err: any) {
          return Response.json({ ok: false, error: String(err?.message ?? err) });
        }
      },
    },
  },
});
