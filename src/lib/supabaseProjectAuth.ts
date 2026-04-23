const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoder = typeof globalThis.atob === "function" ? globalThis.atob : null;
    if (!decoder) {
      return null;
    }
    return decoder(padded);
  } catch {
    return null;
  }
};

const readJwtPayload = (token: string): Record<string, unknown> | null => {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) {
    return null;
  }

  const decoded = decodeBase64Url(payloadSegment);
  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const extractSupabaseProjectRef = (rawUrl: string): string | null => {
  try {
    const hostname = new URL(rawUrl).hostname;
    const match = hostname.match(/^([^.]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

export const isSupabaseSessionForProject = (
  accessToken: string | null | undefined,
  rawSupabaseUrl: string,
): boolean => {
  if (!accessToken) {
    return false;
  }

  const payload = readJwtPayload(accessToken);
  if (!payload) {
    return false;
  }

  const expectedProjectRef = extractSupabaseProjectRef(rawSupabaseUrl);
  if (!expectedProjectRef) {
    return true;
  }

  const tokenRef = String(payload.ref ?? "").trim();
  if (tokenRef) {
    return tokenRef === expectedProjectRef;
  }

  const tokenIssuer = String(payload.iss ?? "").trim();
  if (!tokenIssuer) {
    return false;
  }

  try {
    const issuerUrl = new URL(tokenIssuer);
    return issuerUrl.hostname === `${expectedProjectRef}.supabase.co`;
  } catch {
    return false;
  }
};
