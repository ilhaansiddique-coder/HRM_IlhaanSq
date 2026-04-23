import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { clearAuthBridgeCookies, syncAuthSessionCookie } from "@/lib/authBridge";
import { isSupabaseSessionForProject } from "@/lib/supabaseProjectAuth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  requiresPasswordReset: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPasswordResetStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const FORCE_RESET_SUPPORT_CACHE_KEY = "profiles.force_password_reset.supported";
const getCachedForceResetSupport = () => {
  if (typeof window === "undefined") return true;
  const cached = window.sessionStorage.getItem(FORCE_RESET_SUPPORT_CACHE_KEY);
  if (cached === "false") return false;
  if (cached === "true") return true;
  return true;
};
const setCachedForceResetSupport = (supported: boolean) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FORCE_RESET_SUPPORT_CACHE_KEY, supported ? "true" : "false");
};
let supportsForcePasswordResetColumn = getCachedForceResetSupport();
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;
const tenantOnboardingQueryKeys = {
  tenantId: (userId: string) => ["current-tenant-id", userId] as const,
  userRole: (userId: string) => ["userRole", userId] as const,
};

const isSessionExpiringSoon = (session: Session | null): boolean => {
  if (!session?.expires_at) return false;
  return session.expires_at * 1000 - Date.now() < ACCESS_TOKEN_REFRESH_BUFFER_MS;
};

const purgeMismatchedSession = async () => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Best-effort cleanup only.
  }
  clearAuthBridgeCookies();
};

const getPendingInviteToken = (user: User | null): string | null => {
  const metadata =
    user?.user_metadata && typeof user.user_metadata === "object" && !Array.isArray(user.user_metadata)
      ? (user.user_metadata as Record<string, unknown>)
      : null;

  const inviteToken = String(metadata?.pending_invite_token ?? "").trim();
  if (!inviteToken) {
    return null;
  }

  const flow = String(metadata?.pending_onboarding_flow ?? "").trim();
  if (!flow || flow === "tenant_invite") {
    return inviteToken;
  }

  return null;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const lastForceResetCheckUserId = useRef<string | null>(null);
  const pendingOnboardingKeyRef = useRef<string | null>(null);
  const pendingOnboardingPromiseRef = useRef<Promise<Session | null> | null>(null);
  const failedOnboardingKeysRef = useRef<Set<string>>(new Set());
  const resolvedCacheIdentityRef = useRef<string | null>(null);
  const { toast } = useToast();
  const isLocalSupabase =
    String(supabaseUrl || "").includes("127.0.0.1:54321") ||
    String(supabaseUrl || "").includes("localhost:54321");

  const applyResolvedSession = useCallback(
    (resolvedSession: Session | null, options?: { clearBridge?: boolean }) => {
      const shouldClearBridge = options?.clearBridge === true;
      const nextCacheIdentity = resolvedSession?.user?.id ?? null;

      if (resolvedCacheIdentityRef.current !== nextCacheIdentity) {
        queryClient.clear();
        resolvedCacheIdentityRef.current = nextCacheIdentity;
      }

      setSession(resolvedSession);
      setUser(resolvedSession?.user ?? null);

      if (resolvedSession?.access_token) {
        syncAuthSessionCookie(true);
      } else if (shouldClearBridge) {
        clearAuthBridgeCookies();
      }

      if (!resolvedSession?.user) {
        lastForceResetCheckUserId.current = null;
        pendingOnboardingKeyRef.current = null;
        pendingOnboardingPromiseRef.current = null;
        failedOnboardingKeysRef.current.clear();
        setRequiresPasswordReset(false);
      }

      setLoading(false);
    },
    [queryClient],
  );

  const refreshPasswordResetStatus = useCallback(async (userId?: string | null) => {
    const targetUserId = userId ?? user?.id;
    if (!targetUserId) {
      lastForceResetCheckUserId.current = null;
      setRequiresPasswordReset(false);
      return;
    }
    if (isLocalSupabase) {
      // Local schema can lag behind app migrations; skip forced reset check.
      lastForceResetCheckUserId.current = targetUserId;
      setRequiresPasswordReset(false);
      return;
    }
    if (!supportsForcePasswordResetColumn) {
      lastForceResetCheckUserId.current = targetUserId;
      setRequiresPasswordReset(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("force_password_reset")
      .eq("id", targetUserId)
      .maybeSingle();

    if (error) {
      // Fail open on any profiles lookup issue in local/mismatched schemas.
      supportsForcePasswordResetColumn = false;
      setCachedForceResetSupport(false);
      lastForceResetCheckUserId.current = targetUserId;
      setRequiresPasswordReset(false);
      return;
    }

    supportsForcePasswordResetColumn = true;
    setCachedForceResetSupport(true);
    lastForceResetCheckUserId.current = targetUserId;
    setRequiresPasswordReset(Boolean((data as { force_password_reset?: boolean } | null)?.force_password_reset));
  }, [isLocalSupabase, user?.id]);

  const completePendingTenantOnboarding = useCallback(async (resolvedSession: Session | null) => {
    const pendingInviteToken = getPendingInviteToken(resolvedSession?.user ?? null);
    if (!resolvedSession?.user?.id || !pendingInviteToken || !resolvedSession.user.email_confirmed_at) {
      return resolvedSession;
    }

    const onboardingKey = `${resolvedSession.user.id}:${pendingInviteToken}`;
    if (failedOnboardingKeysRef.current.has(onboardingKey)) {
      return resolvedSession;
    }

    if (pendingOnboardingPromiseRef.current && pendingOnboardingKeyRef.current === onboardingKey) {
      return pendingOnboardingPromiseRef.current;
    }

    setLoading(true);

    const completionPromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("demo-signup", {
          body: {
            action: "complete_onboarding",
            invite_token: pendingInviteToken,
          },
        });

        if (error) {
          throw new Error(error.message || "Failed to complete tenant onboarding.");
        }

        if (!data?.success) {
          throw new Error(data?.error || "Failed to complete tenant onboarding.");
        }

        failedOnboardingKeysRef.current.delete(onboardingKey);
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: tenantOnboardingQueryKeys.userRole(resolvedSession.user.id) }),
          queryClient.invalidateQueries({ queryKey: tenantOnboardingQueryKeys.tenantId(resolvedSession.user.id) }),
        ]);

        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError && !/auth session missing/i.test(refreshError.message)) {
          throw refreshError;
        }

        toast({
          title: "Email verified",
          description: "Your tenant access is ready.",
        });

        return refreshedData.session ?? resolvedSession;
      } catch (error: unknown) {
        failedOnboardingKeysRef.current.add(onboardingKey);
        const message = error instanceof Error ? error.message : "Failed to complete tenant onboarding.";
        toast({
          title: "Onboarding incomplete",
          description: message,
          variant: "destructive",
        });
        return resolvedSession;
      } finally {
        if (pendingOnboardingKeyRef.current === onboardingKey) {
          pendingOnboardingKeyRef.current = null;
          pendingOnboardingPromiseRef.current = null;
        }
      }
    })();

    pendingOnboardingKeyRef.current = onboardingKey;
    pendingOnboardingPromiseRef.current = completionPromise;

    return completionPromise;
  }, [queryClient, toast]);

  const handleResolvedSession = useCallback(
    async (
      resolvedSession: Session | null,
      options?: { clearBridge?: boolean },
    ) => {
      const finalizedSession = await completePendingTenantOnboarding(resolvedSession);

      applyResolvedSession(finalizedSession, options);

      if (finalizedSession?.user?.id) {
        if (lastForceResetCheckUserId.current !== finalizedSession.user.id) {
          lastForceResetCheckUserId.current = finalizedSession.user.id;
        }
        await refreshPasswordResetStatus(finalizedSession.user.id);
      }

      return finalizedSession;
    },
    [applyResolvedSession, completePendingTenantOnboarding, refreshPasswordResetStatus],
  );

  const resolveStoredSession = useCallback(
    async ({
      forceRefresh = false,
      clearBridgeOnFailure = false,
    }: {
      forceRefresh?: boolean;
      clearBridgeOnFailure?: boolean;
    } = {}) => {
      try {
        let resolvedSession: Session | null = null;

        if (!forceRefresh) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            throw error;
          }
          resolvedSession = data.session ?? null;
        }

        if (!resolvedSession?.access_token || forceRefresh || isSessionExpiringSoon(resolvedSession)) {
          const { data, error } = await supabase.auth.refreshSession();
          if (error && !/auth session missing/i.test(error.message)) {
            throw error;
          }
          resolvedSession = data.session ?? resolvedSession;
        }

        if (
          resolvedSession?.access_token &&
          !isSupabaseSessionForProject(resolvedSession.access_token, supabaseUrl)
        ) {
          await purgeMismatchedSession();
          applyResolvedSession(null, { clearBridge: true });
          toast({
            title: "Session reset",
            description: "A saved session from another Supabase environment was cleared. Please sign in again.",
            variant: "destructive",
          });
          return null;
        }

        return await handleResolvedSession(resolvedSession, {
          clearBridge: clearBridgeOnFailure && !resolvedSession?.user,
        });
      } catch {
        applyResolvedSession(null, { clearBridge: clearBridgeOnFailure });
        return null;
      }
    },
    [applyResolvedSession, handleResolvedSession, toast],
  );

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user?.id) {
          setLoading(true);
          setTimeout(() => {
            handleResolvedSession(session).catch(() => {
              applyResolvedSession(session);
              refreshPasswordResetStatus(session.user.id).catch(() => setRequiresPasswordReset(false));
            });
          }, 0);
          return;
        }

        if (event === "SIGNED_OUT") {
          applyResolvedSession(null, { clearBridge: true });
          return;
        }

        void resolveStoredSession();
      }
    );

    // THEN check for existing session with timeout
    const sessionPromise = resolveStoredSession({ clearBridgeOnFailure: true });

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('Auth session check timed out, setting loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    const handleWindowFocus = () => {
      void resolveStoredSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void resolveStoredSession();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Clear timeout when session is resolved
    sessionPromise.finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyResolvedSession, handleResolvedSession, refreshPasswordResetStatus, resolveStoredSession]);

  const signIn = async (email: string, password: string) => {
    let signedIn = false;
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      signedIn = true;
      await refreshPasswordResetStatus();
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error: unknown) {
      const rawMessage = String(error instanceof Error ? error.message : "");
      const description =
        /email not confirmed|email not verified/i.test(rawMessage)
          ? "Verify your email before signing in."
          : isLocalSupabase && /invalid login credentials/i.test(rawMessage)
            ? "Invalid login credentials. If you just reset local DB, create a new account from the Sign Up tab first."
            : rawMessage;

      toast({
        title: "Sign in failed",
        description,
        variant: "destructive",
      });
      throw error;
    } finally {
      if (!signedIn) {
        setLoading(false);
      }
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      void email;
      void password;
      void fullName;
      throw new Error("Direct signup is disabled. Wait for superadmin approval or use a valid invite link.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Signup failed";
      toast({
        title: "Sign up failed",
        description: message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error && !/auth session missing/i.test(error.message)) {
        throw error;
      }
      setSession(null);
      setUser(null);
      setRequiresPasswordReset(false);
      lastForceResetCheckUserId.current = null;
      pendingOnboardingKeyRef.current = null;
      pendingOnboardingPromiseRef.current = null;
      failedOnboardingKeysRef.current.clear();
      clearAuthBridgeCookies();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sign out failed";
      toast({
        title: "Sign out failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    requiresPasswordReset,
    signIn,
    signUp,
    signOut,
    refreshPasswordResetStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
