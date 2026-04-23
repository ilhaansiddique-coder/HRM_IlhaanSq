import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
    };
    tenantId: string | null;
    tenantSlug: string | null;
    role: string | null;
    isSuperAdmin: boolean;
    mustResetPassword: boolean;
  }

  interface User {
    tenantId?: string | null;
    tenantSlug?: string | null;
    role?: string | null;
    isSuperAdmin?: boolean;
    mustResetPassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string | null;
    tenantSlug: string | null;
    role: string | null;
    isSuperAdmin: boolean;
    mustResetPassword: boolean;
  }
}
