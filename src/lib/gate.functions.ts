import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/start-server-core";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type GateSession = {
  siteUnlocked?: boolean;
  inviteUnlocked?: boolean;
};

function getSessionConfig() {
  const password =
    process.env.SITE_GATE_SESSION_SECRET ||
    // Fall back to a deterministic value long enough for iron-session in dev
    "lovable-dev-fallback-session-secret-please-set-SITE_GATE_SESSION_SECRET";
  return {
    password,
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const getGateStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<GateSession>(getSessionConfig());
  return {
    siteUnlocked: !!session.data.siteUnlocked,
    inviteUnlocked: !!session.data.inviteUnlocked,
  };
});

export const unlockGate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        password: z.string().min(1).max(500),
        scope: z.enum(["site", "invite"]).default("site"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const expected = process.env.SITE_PASSWORD;
    if (!expected) {
      throw new Error("SITE_PASSWORD is not configured.");
    }
    if (!passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }
    const session = await useSession<GateSession>(getSessionConfig());
    if (data.scope === "invite") {
      await session.update({
        ...session.data,
        siteUnlocked: true, // unlocking invite also unlocks site
        inviteUnlocked: true,
      });
    } else {
      await session.update({ ...session.data, siteUnlocked: true });
    }
    return { ok: true as const };
  });

export const lockGate = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(getSessionConfig());
  await session.clear();
  return { ok: true as const };
});
