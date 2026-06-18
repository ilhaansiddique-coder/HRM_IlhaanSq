import { getServerSession } from "next-auth/next";
import authConfig from "./auth.config";
import { signIn, signOut } from "next-auth/react";
import { resolveViewOverride, type ViewMode } from "./view-mode";

let cache: any;
let redirect: any;

try {
  ({ cache } = require("react"));
  ({ redirect } = require("next/navigation"));
} catch {
  // Fallback for Node.js scripts
  cache = (fn: any) => fn;
  redirect = () => {};
}

// ─── Get Auth Session (Server-Side) ──────────────────────────

export const auth = cache(async () => {
  return getServerSession(authConfig);
});

export { signIn, signOut };

// ─── Session Types ──────────────────────────────────────────

export type AppSession = {
  userId: string;
  email: string;
  name: string;
  tenantId: string | null;
  tenantSlug: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  mustResetPassword: boolean;
  // The active view when the user switched roles via the "Continue as …"
  // chooser; null when they're in their default (token) role.
  activeView: ViewMode | null;
};

// ─── Cached Session Getter ──────────────────────────────────

export const getSession = cache(async (): Promise<AppSession | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const base: AppSession = {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    tenantId: (session as any).tenantId ?? null,
    tenantSlug: (session as any).tenantSlug ?? null,
    role: (session as any).role ?? null,
    isSuperAdmin: (session as any).isSuperAdmin ?? false,
    mustResetPassword: (session as any).mustResetPassword ?? false,
    activeView: null,
  };

  // Apply the "Continue as …" view override (validated against what the user
  // actually holds). Every downstream isAdmin / role check respects it.
  const override = await resolveViewOverride(base);
  if (override) {
    base.role = override.role;
    base.isSuperAdmin = override.isSuperAdmin;
    base.activeView = override.activeView;
  }

  return base;
});

export const getOptionalSession = cache(async (): Promise<AppSession | null> => {
  try {
    return await getSession();
  } catch (error) {
    console.error(
      "[auth] Optional session lookup failed on a public route.",
      error
    );
    return null;
  }
});

// ─── Auth Guards ────────────────────────────────────────────

export async function requireAuth(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  // NOTE: actor attribution for the notification middleware is set via
  // setRequestActor() in each server ACTION body — not here. enterWith() does
  // not propagate out of requireAuth because getSession() is React-cache-wrapped
  // and runs in a detached async context. See lib/request-actor.ts.
  return session;
}

export async function requireTenant(): Promise<
  AppSession & { tenantId: string; tenantSlug: string }
> {
  const session = await requireAuth();
  if (!session.tenantId || !session.tenantSlug) redirect("/onboarding");
  return session as AppSession & { tenantId: string; tenantSlug: string };
}

export async function requireSuperAdmin(): Promise<AppSession> {
  const session = await requireAuth();
  if (!session.isSuperAdmin) redirect("/hr");
  return session;
}

// ─── Permission Checking ────────────────────────────────────

export async function hasPermission(
  tenantId: string,
  role: string,
  permissionKey: string
): Promise<boolean> {
  if (role === "owner" || role === "admin") return true;

  const { prisma } = await import("./db");
  const permission = await prisma.tenantRolePermission.findUnique({
    where: {
      tenantId_role_permissionKey: {
        tenantId,
        role: role as any,
        permissionKey,
      },
    },
  });

  return permission?.allowed ?? false;
}

// ─── Password Utilities ─────────────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}
