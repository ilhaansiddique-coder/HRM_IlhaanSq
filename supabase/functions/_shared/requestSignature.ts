const SIGNATURE_HEADER = "x-request-signature";
const TIMESTAMP_HEADER = "x-request-timestamp";

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
};

const computeSignature = async (secret: string, payload: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
};

export const verifyOptionalRequestSignature = async (
  req: Request,
  rawBody: string,
  options: {
    secretEnvKey: string;
    maxSkewSeconds?: number;
  },
): Promise<{ ok: boolean; error?: string; enforced: boolean }> => {
  const secret = (Deno.env.get(options.secretEnvKey) ?? "").trim();
  if (!secret) {
    return { ok: true, enforced: false };
  }

  const providedSignature = (req.headers.get(SIGNATURE_HEADER) ?? "").trim().toLowerCase();
  const providedTimestamp = (req.headers.get(TIMESTAMP_HEADER) ?? "").trim();
  if (!providedSignature || !providedTimestamp) {
    return { ok: false, error: "Missing request signature headers", enforced: true };
  }

  const timestampValue = Number(providedTimestamp);
  if (!Number.isFinite(timestampValue)) {
    return { ok: false, error: "Invalid request signature timestamp", enforced: true };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxSkewSeconds = options.maxSkewSeconds ?? 300;
  if (Math.abs(nowSeconds - timestampValue) > maxSkewSeconds) {
    return { ok: false, error: "Request signature timestamp expired", enforced: true };
  }

  const signedPayload = `${providedTimestamp}.${rawBody}`;
  const expectedSignature = await computeSignature(secret, signedPayload);
  if (!safeEqual(expectedSignature, providedSignature)) {
    return { ok: false, error: "Invalid request signature", enforced: true };
  }

  return { ok: true, enforced: true };
};
