import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL } from "./redis";
import { tenantDb } from "./db";
import type { Prisma } from "@prisma/client";

// ─── Cached Data Fetchers ───────────────────────────────────
// Each function: check Redis → hit? return → miss? query Prisma → cache → return.
// Server Components call these directly. Zero loading spinners.

// ─── Products ───────────────────────────────────────────────

type ProductWithVariants = Prisma.ProductGetPayload<{
  include: {
    variants: true;
    attributes: { include: { values: true } };
  };
}>;

const PRODUCTS_LIST_HARD_CAP = 500;

export async function getCachedProducts(
  tenantId: string
): Promise<ProductWithVariants[]> {
  const key = CacheKeys.products(tenantId);
  const cached = await cacheGet<ProductWithVariants[]>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const products = await db.product.findMany({
    where: { isDeleted: false },
    include: {
      variants: true,
      attributes: { include: { values: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PRODUCTS_LIST_HARD_CAP,
  });

  await cacheSet(key, products, { ttl: CacheTTL.LIST });
  return products;
}

export async function getTenantProductCount(tenantId: string): Promise<number> {
  const db = tenantDb(tenantId);
  return db.product.count({ where: { isDeleted: false } });
}

export async function getCachedProduct(
  tenantId: string,
  productId: string
): Promise<ProductWithVariants | null> {
  const key = CacheKeys.product(tenantId, productId);
  const cached = await cacheGet<ProductWithVariants>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const product = await db.product.findFirst({
    where: { id: productId, isDeleted: false },
    include: {
      variants: true,
      attributes: { include: { values: true } },
    },
  });

  if (product) {
    await cacheSet(key, product, { ttl: CacheTTL.ENTITY });
  }
  return product;
}

export async function invalidateProductCache(tenantId: string, productId?: string) {
  await cacheDel(CacheKeys.products(tenantId));
  if (productId) {
    await cacheDel(CacheKeys.product(tenantId, productId));
  }
  await cacheDel(CacheKeys.dashboard(tenantId));
}

// ─── Customers ──────────────────────────────────────────────

const CUSTOMERS_LIST_HARD_CAP = 500;

export async function getCachedCustomers(tenantId: string) {
  const key = CacheKeys.customers(tenantId);
  const cached = await cacheGet<Prisma.CustomerGetPayload<object>[]>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const customers = await db.customer.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: CUSTOMERS_LIST_HARD_CAP,
  });

  await cacheSet(key, customers, { ttl: CacheTTL.LIST });
  return customers;
}

export async function invalidateCustomerCache(tenantId: string) {
  await cacheDel(CacheKeys.customers(tenantId));
  await cacheDel(CacheKeys.dashboard(tenantId));
}

// ─── Sales ──────────────────────────────────────────────────

type SaleWithItems = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true; variant: true } };
    customer: true;
    creator: { select: { id: true; fullName: true; email: true } };
    payments: true;
  };
}>;

export async function getCachedSales(tenantId: string): Promise<SaleWithItems[]> {
  const key = CacheKeys.sales(tenantId);
  const cached = await cacheGet<SaleWithItems[]>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const sales = await db.sale.findMany({
    where: { isDeleted: false },
    include: {
      items: { include: { product: true, variant: true } },
      customer: true,
      creator: { select: { id: true, fullName: true, email: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  await cacheSet(key, sales, { ttl: CacheTTL.LIST });
  return sales;
}

export async function invalidateSaleCache(tenantId: string) {
  await cacheDel(CacheKeys.sales(tenantId));
  await cacheDel(CacheKeys.dashboard(tenantId));
}

// ─── Dashboard Metrics ──────────────────────────────────────

export type DashboardMetrics = {
  totalProducts: number;
  totalCustomers: number;
  totalSales: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  todaySales: number;
  todayRevenue: number;
};

export async function getCachedDashboard(
  tenantId: string
): Promise<DashboardMetrics> {
  const key = CacheKeys.dashboard(tenantId);
  const cached = await cacheGet<DashboardMetrics>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalProducts,
    totalCustomers,
    totalSalesCount,
    revenueAgg,
    pendingOrders,
    lowStockProducts,
    todaySalesCount,
    todayRevenueAgg,
  ] = await Promise.all([
    db.product.count({ where: { isDeleted: false } }),
    db.customer.count({ where: { isDeleted: false } }),
    db.sale.count({ where: { isDeleted: false } }),
    db.sale.aggregate({
      where: { isDeleted: false, paymentStatus: { not: "cancelled" } },
      _sum: { grandTotal: true },
    }),
    db.sale.count({
      where: { isDeleted: false, orderStatus: "pending" },
    }),
    db.product.count({
      where: { isDeleted: false, stockQuantity: { lte: 10 } },
    }),
    db.sale.count({
      where: { isDeleted: false, createdAt: { gte: today } },
    }),
    db.sale.aggregate({
      where: {
        isDeleted: false,
        createdAt: { gte: today },
        paymentStatus: { not: "cancelled" },
      },
      _sum: { grandTotal: true },
    }),
  ]);

  const metrics: DashboardMetrics = {
    totalProducts,
    totalCustomers,
    totalSales: totalSalesCount,
    totalRevenue: Number(revenueAgg._sum.grandTotal ?? 0),
    pendingOrders,
    lowStockProducts,
    todaySales: todaySalesCount,
    todayRevenue: Number(todayRevenueAgg._sum.grandTotal ?? 0),
  };

  await cacheSet(key, metrics, { ttl: CacheTTL.DASHBOARD });
  return metrics;
}

// ─── Settings ───────────────────────────────────────────────

export async function getCachedBusinessSettings(tenantId: string) {
  const key = CacheKeys.businessSettings(tenantId);
  const cached = await cacheGet<Prisma.BusinessSettingsGetPayload<object>>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const settings = await db.businessSettings.findUnique({
    where: { tenantId },
  });

  if (settings) {
    await cacheSet(key, settings, { ttl: CacheTTL.SETTINGS });
  }
  return settings;
}

export async function getCachedSystemSettings(tenantId: string) {
  const key = CacheKeys.systemSettings(tenantId);
  const cached = await cacheGet<Prisma.SystemSettingsGetPayload<object>>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const settings = await db.systemSettings.findUnique({
    where: { tenantId },
  });

  if (settings) {
    await cacheSet(key, settings, { ttl: CacheTTL.SETTINGS });
  }
  return settings;
}

export async function invalidateSettingsCache(tenantId: string) {
  await cacheDel(
    CacheKeys.businessSettings(tenantId),
    CacheKeys.systemSettings(tenantId)
  );
}

// ─── Payment Methods ────────────────────────────────────────

export async function getCachedPaymentMethods(tenantId: string) {
  const key = CacheKeys.paymentMethods(tenantId);
  const cached = await cacheGet<Prisma.PaymentMethodGetPayload<object>[]>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const methods = await db.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  await cacheSet(key, methods, { ttl: CacheTTL.SETTINGS });
  return methods;
}
