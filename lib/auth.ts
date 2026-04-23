import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { prisma } from "./db";
import { checkRate } from "./rate-limit";

// ─── Full NextAuth Config (Node Runtime) ────────────────────
// This file extends auth.config.ts with the Credentials provider
// (which uses Prisma + bcrypt — both Node-only).
// Imported by app routes and Server Actions, NEVER by middleware.

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const t0 = Date.now();
        const mark = (label: string) =>
          console.log(`[auth-timing] ${label}: ${Date.now() - t0}ms`);

        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const tRate = Date.now();
        const rate = await checkRate("auth", `auth:${email}`);
        console.log(`[auth-timing] rate-limit: ${Date.now() - tRate}ms`);
        if (!rate.allowed) {
          throw new Error(
            `Too many login attempts. Try again in ${rate.retryAfterSec}s.`
          );
        }

        const tDb = Date.now();
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: {
              where: { isActive: true },
              include: {
                tenant: {
                  select: { id: true, slug: true, name: true, isActive: true },
                },
              },
              orderBy: { isDefault: "desc" },
            },
          },
        });
        console.log(`[auth-timing] db-findUser: ${Date.now() - tDb}ms`);

        if (!user) {
          mark("done(no-user)");
          return null;
        }

        const tBcrypt = Date.now();
        const isValid = await bcrypt.compare(password, user.passwordHash);
        console.log(`[auth-timing] bcrypt-compare: ${Date.now() - tBcrypt}ms`);
        if (!isValid) {
          mark("done(bad-pw)");
          return null;
        }

        // Update last sign-in timestamp (fire and forget)
        prisma.user
          .update({
            where: { id: user.id },
            data: { lastSignInAt: new Date() },
          })
          .catch(() => {});

        mark("done(success)");

        const defaultMembership =
          user.memberships.find((m) => m.isDefault) ?? user.memberships[0];

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.image,
          tenantId: defaultMembership?.tenant.id ?? null,
          tenantSlug: defaultMembership?.tenant.slug ?? null,
          role: user.isSuperAdmin
            ? "superadmin"
            : (defaultMembership?.role ?? null),
          isSuperAdmin: user.isSuperAdmin,
          mustResetPassword: user.mustResetPassword,
        } as any;
      },
    }),
  ],
});

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
};

// ─── Cached Session Getter ──────────────────────────────────
// React `cache()` deduplicates within a single request.
// No matter how many Server Components call getSession(),
// the auth check only happens once per request.

export const getSession = cache(async (): Promise<AppSession | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    tenantId: (session as any).tenantId ?? null,
    tenantSlug: (session as any).tenantSlug ?? null,
    role: (session as any).role ?? null,
    isSuperAdmin: (session as any).isSuperAdmin ?? false,
    mustResetPassword: (session as any).mustResetPassword ?? false,
  };
});

// ─── Auth Guards ────────────────────────────────────────────

export async function requireAuth(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
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
  if (!session.isSuperAdmin) redirect("/dashboard");
  return session;
}

// ─── Permission Checking ────────────────────────────────────

export async function hasPermission(
  tenantId: string,
  role: string,
  permissionKey: string
): Promise<boolean> {
  if (role === "owner" || role === "admin") return true;

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
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
