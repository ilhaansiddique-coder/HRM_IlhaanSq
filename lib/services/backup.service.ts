import { prisma } from "../db";

// ─── Export entire tenant data as JSON ──────────────────────

export async function exportTenantData(tenantId: string) {
  const [
    tenant,
    members,
    products,
    productVariants,
    customers,
    sales,
    saleItems,
    paymentMethods,
    businessSettings,
    systemSettings,
    courierProviders,
    inventoryLogs,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.tenantMember.findMany({ where: { tenantId } }),
    prisma.product.findMany({ where: { tenantId } }),
    prisma.productVariant.findMany({ where: { product: { tenantId } } }),
    prisma.customer.findMany({ where: { tenantId } }),
    prisma.sale.findMany({ where: { tenantId } }),
    prisma.saleItem.findMany({ where: { sale: { tenantId } } }),
    prisma.paymentMethod.findMany({ where: { tenantId } }),
    prisma.businessSettings.findUnique({ where: { tenantId } }),
    prisma.systemSettings.findUnique({ where: { tenantId } }),
    prisma.courierProvider.findMany({ where: { tenantId } }),
    prisma.inventoryLog.findMany({ where: { tenantId }, take: 5000 }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    members,
    products,
    productVariants,
    customers,
    sales,
    saleItems,
    paymentMethods,
    businessSettings,
    systemSettings,
    courierProviders,
    inventoryLogs,
  };
}

// ─── Counts for system health panel ─────────────────────────

export async function getSystemStats(tenantId: string) {
  const [
    productCount,
    customerCount,
    saleCount,
    activityLogCount,
    deletedCount,
  ] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId } }),
    prisma.activityLog.count({ where: { tenantId } }),
    Promise.all([
      prisma.product.count({ where: { tenantId, isDeleted: true } }),
      prisma.sale.count({ where: { tenantId, isDeleted: true } }),
      prisma.customer.count({ where: { tenantId, isDeleted: true } }),
    ]).then(([p, s, c]) => p + s + c),
  ]);

  return { productCount, customerCount, saleCount, activityLogCount, deletedCount };
}
