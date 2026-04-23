import { prisma } from "../db";

export async function getRevenueByDay(tenantId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      isDeleted: false,
      paymentStatus: { not: "cancelled" },
      createdAt: { gte: startDate },
    },
    select: { createdAt: true, grandTotal: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const byDay = new Map<string, number>();
  for (const sale of sales) {
    const day = sale.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(sale.grandTotal));
  }

  // Fill missing days with 0
  const result: { date: string; revenue: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    result.push({ date: day, revenue: byDay.get(day) ?? 0 });
  }

  return result;
}

export async function getTopProducts(tenantId: string, limit: number = 10) {
  const items = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      sale: { tenantId, isDeleted: false, paymentStatus: { not: "cancelled" } },
    },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { totalPrice: "desc" } },
    take: limit,
  });

  const productIds = items
    .map((i) => i.productId)
    .filter((id): id is string => id != null);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, name: true, sku: true, imageUrl: true },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  return items.map((i) => ({
    product: productMap.get(i.productId!),
    quantitySold: i._sum.quantity ?? 0,
    revenue: Number(i._sum.totalPrice ?? 0),
  }));
}

export async function getPaymentBreakdown(tenantId: string) {
  const breakdown = await prisma.sale.groupBy({
    by: ["paymentStatus"],
    where: { tenantId, isDeleted: false },
    _sum: { grandTotal: true },
    _count: true,
  });

  return breakdown.map((b) => ({
    status: b.paymentStatus,
    count: b._count,
    total: Number(b._sum.grandTotal ?? 0),
  }));
}

export async function getLowStockProducts(tenantId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      sku: string | null;
      stockQuantity: number;
      lowStockThreshold: number;
      imageUrl: string | null;
    }>
  >`
    SELECT id, name, sku,
           stock_quantity AS "stockQuantity",
           low_stock_threshold AS "lowStockThreshold",
           image_url AS "imageUrl"
    FROM products
    WHERE tenant_id = ${tenantId}::uuid
      AND is_deleted = false
      AND stock_quantity <= low_stock_threshold
    ORDER BY stock_quantity ASC
    LIMIT 50
  `;
  return rows;
}

export async function getPendingOrders(tenantId: string) {
  return prisma.sale.findMany({
    where: {
      tenantId,
      isDeleted: false,
      OR: [
        { orderStatus: "pending" },
        { courierStatus: "not_sent" },
        { paymentStatus: "pending" },
      ],
    },
    include: {
      items: { include: { product: true } },
      customer: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
