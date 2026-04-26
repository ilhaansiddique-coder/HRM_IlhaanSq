import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "./server-env";

// ─── Singleton Prisma Client ────────────────────────────────
// Prevents multiple instances in development (hot-reload).
// Prisma v7 requires a database adapter — using PrismaPg for PostgreSQL.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const { connectionString, source } = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL, PLATFORM_DATABASE_POOLER_URL, PLATFORM_DATABASE_URL, or SUPABASE_DB_URL."
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[db] Prisma configured via ${source}.`);
  }

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ─── Tenant-Scoped Client ───────────────────────────────────
// Uses Prisma Client Extensions (v7) to auto-filter reads by tenantId.
// For writes, services pass tenantId explicitly — Prisma enforces this at the type level.
//
// Usage:
//   const db = tenantDb("tenant-uuid");
//   const products = await db.product.findMany({ where: { isDeleted: false } });
//   // ^ tenantId is auto-injected into the where clause

export function tenantDb(tenantId: string) {
  return prisma.$extends({
    query: {
      // Auto-inject tenantId for reads on all tenant-scoped models
      product: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async aggregate({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
      customer: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
      sale: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async aggregate({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
      },
      inventoryLog: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
      activityLog: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
      paymentMethod: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
      businessSettings: {
        async findUnique({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
      },
      systemSettings: {
        async findUnique({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
      },
    },
  });
}

// ─── Type for the extended client ───────────────────────────
export type TenantPrismaClient = ReturnType<typeof tenantDb>;

// ─── Helper: Get a tenant-scoped client from session ────────
import { requireTenant } from "./auth";

export async function getTenantDb() {
  const session = await requireTenant();
  return { db: tenantDb(session.tenantId), session };
}
