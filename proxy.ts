import NextAuth from "next-auth";
import authConfig from "./lib/auth.config";

// Edge-safe proxy (was middleware.ts in Next ≤15; renamed to proxy.ts in
// Next 16 — same shape, same behavior, new file convention name). Uses
// ONLY auth.config (no Prisma, no bcrypt, no pg) so it stays edge-safe.
// The full auth instance with the Credentials provider lives in
// lib/auth.ts and is only used by Server Components, Server Actions,
// and Route Handlers.
//
// Pull the destructure out before exporting so Next 16's loader can
// statically detect the function — `export const { auth: x } = ...`
// fails with "must export a function".
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icons|images|fonts|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
