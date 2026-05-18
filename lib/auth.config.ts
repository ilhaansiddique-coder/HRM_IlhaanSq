import type { JWT } from "next-auth/jwt";

// ─── Edge-Safe Config ───────────────────────────────────────
// This file is imported by middleware (Edge Runtime).
// It must NOT import Prisma, bcrypt, pg, or any Node-only modules.
// Providers that need the database live in lib/auth.ts (Node runtime only).

export default {
  providers: [], // Real providers added in lib/auth.ts
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger }: any) {
      if (user) {
        token.id = user.id as string;
        token.tenantId = (user as any).tenantId ?? null;
        token.tenantSlug = (user as any).tenantSlug ?? null;
        token.role = (user as any).role ?? null;
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false;
        token.mustResetPassword = (user as any).mustResetPassword ?? false;
      }
      // Allow `update()` from the client to refresh the flag (e.g. after password change)
      if (trigger === "update") {
        token.mustResetPassword = false;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      (session as any).tenantId = token.tenantId ?? null;
      (session as any).tenantSlug = token.tenantSlug ?? null;
      (session as any).role = token.role ?? null;
      (session as any).isSuperAdmin = token.isSuperAdmin ?? false;
      (session as any).mustResetPassword = token.mustResetPassword ?? false;
      return session;
    },
    async authorized({ auth, request }: any) {
      const { pathname, origin } = request.nextUrl;

      const publicPaths = new Set([
        "/",
        "/login",
        "/auth",
        "/request-demo",
        "/reset-password",
      ]);
      const isPublic =
        publicPaths.has(pathname) ||
        pathname.startsWith("/invite/") ||
        pathname.startsWith("/reset-password/") ||
        pathname.startsWith("/careers/") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/icons") ||
        pathname.startsWith("/images");

      if (!auth?.user && !isPublic) return false;

      // FORCED PASSWORD RESET: if the user has a temporary password, lock them
      // out of every page except /change-password until they reset it.
      const mustReset = (auth as any)?.mustResetPassword === true;
      if (
        auth?.user &&
        mustReset &&
        pathname !== "/change-password" &&
        !pathname.startsWith("/api/auth")
      ) {
        return Response.redirect(new URL("/change-password", origin));
      }

      return true;
    },
  },
};
