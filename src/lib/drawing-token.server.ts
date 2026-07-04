import { createHmac, timingSafeEqual } from "crypto";

export type DrawingAccessPayload = {
  drawingId: string;
  userId: string;
  exp: number;
  nonce: string;
};

const TOKEN_VERSION = "v1";

function encodeJson(value: DrawingAccessPayload): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value: string): DrawingAccessPayload {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as DrawingAccessPayload;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function getDrawingAccessSecret(): string {
  const secret = process.env.LOVABLE_API_KEY;
  if (!secret) throw new Error("Secure drawing links are unavailable.");
  return secret;
}

export function createDrawingAccessToken(
  payload: DrawingAccessPayload,
  secret: string,
): string {
  const body = encodeJson(payload);
  const signedBody = `${TOKEN_VERSION}.${body}`;
  return `${signedBody}.${sign(signedBody, secret)}`;
}

export function verifyDrawingAccessToken(token: string, secret: string): DrawingAccessPayload {
  const [version, body, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !body || !signature) {
    throw new Error("Invalid drawing access token.");
  }

  const signedBody = `${version}.${body}`;
  const expected = sign(signedBody, secret);
  if (!safeEqual(expected, signature)) {
    throw new Error("Invalid drawing access token.");
  }

  const payload = decodeJson(body);
  if (!payload.drawingId || !payload.userId || !payload.exp || payload.exp < Date.now()) {
    throw new Error("Drawing access token expired.");
  }
  return payload;
}