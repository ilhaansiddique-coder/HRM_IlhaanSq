import { prisma } from "../db";

// ─── Period-over-period analytics ───────────────────────────
// Compare current N days against previous N days, returns percent change.

function periodRange(days: number) {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);
  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd: currentStart,
  };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export type PeriodMetric = {
  label: string;
  current: number;
  previous: number;
  changePercent: number;
};

export async function getAdminAnalytics(tenantId: string, days: number = 30) {
  const { currentStart, currentEnd, previousStart, previousEnd } = periodRange(days);
  const profitWindow = periodRange(90);

  const [
    revenueCurrent,
    revenuePrevious,
    ordersCurrent,
    ordersPrevious,
    customersCurrent,
    customersPrevious,
    profitCurrent,
    profitPrevious,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        tenantId,
        isDeleted: false,
        paymentStatus: { not: "cancelled" },
        createdAt: { gte: currentStart, lt: currentEnd },
      },
      _sum: { grandTotal: true },
    }),
    prisma.sale.aggregate({
      where: {
        tenantId,
        isDeleted: false,
        paymentStatus: { not: "cancelled" },
        createdAt: { gte: previousStart, lt: previousEnd },
      },
      _sum: { grandTotal: true },
    }),
    prisma.sale.count({
      where: {
        tenantId,
        isDeleted: false,
        createdAt: { gte: currentStart, lt: currentEnd },
      },
    }),
    prisma.sale.count({
      where: {
        tenantId,
        isDeleted: false,
        createdAt: { gte: previousStart, lt: previousEnd },
      },
    }),
    prisma.customer.count({
      where: {
        tenantId,
        isDeleted: false,
        createdAt: { gte: currentStart, lt: currentEnd },
      },
    }),
    prisma.customer.count({
      where: {
        tenantId,
        isDeleted: false,
        createdAt: { gte: previousStart, lt: previousEnd },
      },
    }),
    // Net profit = revenue - cost of goods sold (rough)
    prisma.saleItem.aggregate({
      where: {
        sale: {
          tenantId,
          isDeleted: false,
          paymentStatus: { not: "cancelled" },
          createdAt: { gte: profitWindow.currentStart },
        },
      },
      _sum: { totalPrice: true },
    }),
    prisma.saleItem.aggregate({
      where: {
        sale: {
          tenantId,
          isDeleted: false,
          paymentStatus: { not: "cancelled" },
          createdAt: { gte: profitWindow.previousStart, lt: profitWindow.previousEnd },
        },
      },
      _sum: { totalPrice: true },
    }),
  ]);

  const revenue: PeriodMetric = {
    label: `Revenue (${days}d)`,
    current: Number(revenueCurrent._sum.grandTotal ?? 0),
    previous: Number(revenuePrevious._sum.grandTotal ?? 0),
    changePercent: pctChange(
      Number(revenueCurrent._sum.grandTotal ?? 0),
      Number(revenuePrevious._sum.grandTotal ?? 0)
    ),
  };
  const orders: PeriodMetric = {
    label: `Orders (${days}d)`,
    current: ordersCurrent,
    previous: ordersPrevious,
    changePercent: pctChange(ordersCurrent, ordersPrevious),
  };
  const customers: PeriodMetric = {
    label: `New Customers (${days}d)`,
    current: customersCurrent,
    previous: customersPrevious,
    changePercent: pctChange(customersCurrent, customersPrevious),
  };
  const profit: PeriodMetric = {
    label: `Net Profit (90d)`,
    current: Number(profitCurrent._sum.totalPrice ?? 0),
    previous: Number(profitPrevious._sum.totalPrice ?? 0),
    changePercent: pctChange(
      Number(profitCurrent._sum.totalPrice ?? 0),
      Number(profitPrevious._sum.totalPrice ?? 0)
    ),
  };

  return { revenue, orders, customers, profit };
}

export async function getRecentActivity(tenantId: string, limit: number = 25) {
  return prisma.activityLog.findMany({
    where: { tenantId },
    include: {
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
