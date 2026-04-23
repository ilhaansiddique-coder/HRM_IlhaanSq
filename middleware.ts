import NextAuth from "next-auth";
import authConfig from "./lib/auth.config";

// Edge-safe middleware: uses ONLY auth.config (no Prisma, no bcrypt, no pg).
// The full auth instance with Credentials provider lives in lib/auth.ts
// and is only used by Server Components, Server Actions, and Route Handlers.

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|images|fonts|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
