import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/lib/auth.config";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function getPrisma() {
  return (await import("@/lib/db")).prisma;
}

const authOptions = {
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const rate = await checkRate("auth", `auth:${email}`);
        if (!rate.allowed) {
          throw new Error(
            `Too many login attempts. Try again in ${rate.retryAfterSec}s.`
          );
        }

        const prisma = await getPrisma();
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

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        prisma.user
          .update({
            where: { id: user.id },
            data: { lastSignInAt: new Date() },
          })
          .catch(() => {});

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
};

const handler = NextAuth(authOptions);

export const GET = handler;
export const POST = handler;
