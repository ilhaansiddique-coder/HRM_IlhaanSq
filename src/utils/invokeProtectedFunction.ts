import { type FunctionInvokeOptions, type Session } from "@supabase/supabase-js";

import { supabase, supabaseAnonKey, supabaseUrl } from "@/integrations/supabase/client";
import { clearAuthBridgeCookies } from "@/lib/authBridge";
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

type FunctionInvokeError = Error & {
  status?: number;
};

const isUnauthorizedStatus = (status: number): boolean => status === 401;

const extractResponseMessage = async (response: Response): Promise<string> => {
  let details = "";

  try {
    const bodyText = (await response.clone().text())?.trim() ?? "";
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as {
          error?: string;
          message?: string;
        };
        details = String(parsed.error ?? parsed.message ?? bodyText).trim();
      } catch {
        details = bodyText;
      }
    }
  } catch {
    details = "";
  }

  if (details) {
    return `${details} (HTTP ${response.status})`;
  }

  return `Edge Function request failed (HTTP ${response.status})`;
};

const normalizeInvokeError = async (error: unknown): Promise<FunctionInvokeError> => {
  const functionError = new Error("Edge Function request failed") as FunctionInvokeError;

  if (error instanceof Error && error.message) {
    functionError.message = error.message;
  }

  if (error && typeof error === "object" && "context" in error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      functionError.status = response.status;
      functionError.message = await extractResponseMessage(response);
    }
  }

  return functionError;
};

const isUnauthorizedError = (error: unknown): boolean => {
  if (error && typeof error === "object" && "status" in error) {
    return isUnauthorizedStatus(Number((error as { status?: number }).status ?? 0));
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /invalid jwt|unauthorized|http 401|\b401\b/i.test(message);
};

const invokeWithSession = async <T>(
  functionName: string,
  session: Session,
  options: FunctionInvokeOptions = {},
): Promise<T> => {
  const headers = new Headers(options.headers ?? {});

  headers.set("apikey", supabaseAnonKey);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  const { data, error } = await supabase.functions.invoke(functionName, {
    ...options,
    headers,
  });

  if (error) {
    throw await normalizeInvokeError(error);
  }

  return (data ?? null) as T;
};

export const invokeProtectedFunction = async <T>(
  functionName: string,
  options: FunctionInvokeOptions = {},
): Promise<T> => {
  try {
    const session = await resolveUsableSession(false);
    return await invokeWithSession<T>(functionName, session, options);
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      throw error instanceof Error ? error : new Error(String(error ?? "Edge Function request failed"));
    }

    const session = await resolveUsableSession(true);
    return await invokeWithSession<T>(functionName, session, options);
  }
};
