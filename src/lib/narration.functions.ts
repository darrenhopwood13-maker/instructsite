import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Voice configuration — change the voice/model in ONE place.                */
/* -------------------------------------------------------------------------- */

export const NARRATION_CONFIG = {
  /** George — clear British-English male voice from the ElevenLabs library. */
  voiceId: "JBFqnCBsd6RMkjVDRZzb",
  /** Fast, high-quality streaming-friendly model. */
  modelId: "eleven_turbo_v2_5",
  /** Storage bucket. Private. */
  bucket: "guide-narration",
  /** Signed URL lifetime, seconds. */
  signedUrlTtlSeconds: 60 * 30,
} as const;

/* -------------------------------------------------------------------------- */

const inputSchema = z.object({
  text: z.string().min(1).max(1200),
  voiceId: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
});

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const getGuideNarration = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const voiceId = data.voiceId ?? NARRATION_CONFIG.voiceId;
    const modelId = data.modelId ?? NARRATION_CONFIG.modelId;
    const text = data.text.trim();

    const hash = await sha256Hex(`${voiceId}::${modelId}::${text}`);
    const objectPath = `${hash}.mp3`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = NARRATION_CONFIG.bucket;

    // Try signed URL first — if the object exists we're done, no ElevenLabs call.
    const existing = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(objectPath, NARRATION_CONFIG.signedUrlTtlSeconds);
    if (existing.data?.signedUrl) {
      return { url: existing.data.signedUrl, cached: true as const };
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { url: null, cached: false as const, reason: "no_key" as const };
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[narration] ElevenLabs failed [${res.status}]: ${body.slice(0, 300)}`);
      return { url: null, cached: false as const, reason: "provider_failed" as const };
    }

    const audio = new Uint8Array(await res.arrayBuffer());

    const upload = await supabaseAdmin.storage
      .from(bucket)
      .upload(objectPath, audio, { contentType: "audio/mpeg", upsert: true });
    if (upload.error) {
      console.error("[narration] upload failed", upload.error.message);
      return { url: null, cached: false as const, reason: "upload_failed" as const };
    }

    const signed = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(objectPath, NARRATION_CONFIG.signedUrlTtlSeconds);
    if (!signed.data?.signedUrl) {
      return { url: null, cached: false as const, reason: "sign_failed" as const };
    }

    return { url: signed.data.signedUrl, cached: false as const };
  });
