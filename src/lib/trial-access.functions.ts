import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Free-trial signups are gated behind a single fixed access password that is
 * shared with prospects out-of-band. The password is verified server-side
 * only — it never ships to the browser bundle.
 */
export const verifyTrialAccess = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        accessPassword: z.string().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const expected = process.env.TRIAL_ACCESS_PASSWORD;
    if (!expected) {
      return { ok: false as const, reason: "Free trial access is not configured." };
    }
    const a = createHash("sha256").update(data.accessPassword, "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    if (!timingSafeEqual(a, b)) {
      return { ok: false as const, reason: "Incorrect free trial access password." };
    }
    return { ok: true as const };
  });
