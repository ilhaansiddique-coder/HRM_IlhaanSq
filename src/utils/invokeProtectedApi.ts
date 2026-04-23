import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseAnonKey, supabaseUrl } from "@/integrations/supabase/client";
import { clearAuthBridgeCookies } from "@/lib/authBridge";
import { resolveApiBaseUrl } from "@/lib/runtimeUrls";
import { isSupabaseSessionForProject } from "@/lib/supabaseProjectAuth";

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;

const isSessionExpiringSoon = (session: Session | null): boolean => {
  if (!session?.expires_at) return false;
  return session.expires_at * 1000 - Date.now() < ACCESS_TOKEN_REFRESH_BUFFER_MS;
};

const readSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message || "Failed to read auth session");
  }
  return data.session ?? null;
};

const refreshSession = async (): Promise<Session | null> => {
  const currentSession = await readSession();
  if (!currentSession?.refresh_token) {
    return currentSession;
  }

  const { data, error } = await supabase.auth.refreshSession();

  if (error && !/auth session missing/i.test(error.message)) {
    throw new Error(error.message || "Failed to refresh auth session");
  }

  return data.session ?? (await readSession());
};

const resolveUsableSession = async (forceRefresh = false): Promise<Session> => {
  let session = forceRefresh ? await refreshSession() : await readSession();

  if (!session?.access_token) {
    session = await refreshSession();
  } else if (!forceRefresh && isSessionExpiringSoon(session)) {
    session = await refreshSession();
  }

  if (!session?.access_token) {
    session = await readSession();
  }

  if (session?.access_token && !isSupabaseSessionForProject(session.access_token, supabaseUrl)) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Best-effort cleanup only.
    }
    clearAuthBridgeCookies();
    throw new Error("Saved auth session belongs to a different Supabase project. Please sign in again.");
  }

  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  return session;
};

const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  "";

const requestWithSession = async <T>(
  path: string,
  session: Session,
  init: RequestInit = {},
): Promise<Response> => {
  const apiBaseUrl = resolveApiBaseUrl(configuredApiUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${apiBaseUrl}${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
    },
  });

  return response;
};

const executeApiRequest = async <T>(
  path: string,
  session: Session,
  init: RequestInit = {},
): Promise<Response> => {
  try {
    return await requestWithSession<T>(path, session, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/failed to fetch|networkerror|err_connection_refused|econnrefused/i.test(message)) {
      throw new Error(
        `Cannot connect to API at ${resolveApiBaseUrl(configuredApiUrl)}. Start the backend with \`npm run api:dev\` or \`npm run dev\`.`,
      );
    }
    throw error instanceof Error ? error : new Error("API request failed");
  }
};

export const invokeProtectedApi = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let session = await resolveUsableSession(false);
  let response = await executeApiRequest<T>(path, session, init);

  if (response.status === 401) {
    session = await resolveUsableSession(true);
    response = await executeApiRequest<T>(path, session, init);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
};
