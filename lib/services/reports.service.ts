import { Prisma } from "@prisma/client";
import { prisma } from "../db";

// ─── Shared helpers (rich reports module) ───────────────────
//
// `Scope` mirrors the dashboard-analytics pattern:
//   null  → cross-tenant (super admin)
//   uuid  → single tenant
//
// Status classifiers below match the Vite reference's lifecycle rules:
//   excluded   = courier in {cancel*, return*, lost*} OR payment="cancelled"
//   successful = NOT excluded AND (delivered/completed OR pending/paid/partial)
// "Recognized revenue" treats partial-paid orders as the paid amount only,
// everything else as full grandTotal — both net of `fee`.

type Scope = string | null;

const EXCLUDED_COURIER_STATUSES = [
  "cancelled",
  "returned",
  "lost",
  "delivery_failed",
];

const SUCCESSFUL_COURIER_STATUSES = ["delivered", "completed"];

function tenantWhere(tenantId: Scope): Prisma.SaleWhereInput {
  return tenantId ? { tenantId } : {};
}

function dateWhere(start: Date | null, end: Date | null): Prisma.SaleWhereInput {
  if (!start && !end) return {};
  return {
    createdAt: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    },
  };
}

const isExcludedSale = (s: {
  courierStatus?: string | null;
  paymentStatus?: string | null;
}) => {
  const c = String(s.courierStatus ?? "").toLowerCase();
  const p = String(s.paymentStatus ?? "").toLowerCase();
  return (
    c.includes("cancel") ||
    c.includes("return") ||
    c.includes("lost") ||
    p === "cancelled"
  );
};

const isSuccessfulSale = (s: {
  courierStatus?: string | null;
  paymentStatus?: string | null;
}) => {
  if (isExcludedSale(s)) return false;
  const c = String(s.courierStatus ?? "").toLowerCase();
  const p = String(s.paymentStatus ?? "").toLowerCase();
  return (
    c.includes("delivered") ||
    c.includes("completed") ||
    p === "paid" ||
    p === "pending" ||
    p === "partial"
  );
};

const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

const netAmount = (s: {
  grandTotal?: Prisma.Decimal | number | null;
  fee?: Prisma.Decimal | number | null;
}) => Math.max(0, num(s.grandTotal) - num(s.fee));

const netPaid = (s: {
  amountPaid?: Prisma.Decimal | number | null;
  fee?: Prisma.Decimal | number | null;
}) => Math.max(0, num(s.amountPaid) - num(s.fee));

const recognizedRevenue = (s: {
  grandTotal?: Prisma.Decimal | number | null;
  amountPaid?: Prisma.Decimal | number | null;
  fee?: Prisma.Decimal | number | null;
  paymentStatus?: string | null;
}) =>
  String(s.paymentStatus ?? "").toLowerCase() === "partial"
    ? netPaid(s)
    : netAmount(s);


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

// ═══════════════════════════════════════════════════════════════
// RICH REPORTS — date-range scoped aggregations consumed by
// /reports and /reports/case-study-sales-2026.
// ═══════════════════════════════════════════════════════════════

// Internal projection: every aggregator below loads sales (with their
// items) once, then computes its own slice of the dashboard. A single
// fetch keeps the report consistent across cards (KPI total = sum of
// histogram bars = sum of items-sold value).
type ReportSale = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerAddress: string | null;
  invoiceNumber: string;
  grandTotal: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  amountDue: Prisma.Decimal;
  reviewAmountDue: Prisma.Decimal | null;
  fee: Prisma.Decimal;
  paymentMethod: string;
  paymentStatus: string;
  paymentTerms: string;
  courierStatus: string | null;
  courierName: string | null;
  createdAt: Date;
  items: {
    quantity: number;
    totalPrice: Prisma.Decimal;
    productId: string | null;
    product: {
      id: string;
      name: string;
      sku: string | null;
      imageUrl: string | null;
    } | null;
    variant: { id: string; imageUrl: string | null } | null;
  }[];
};

async function fetchReportSales(
  scope: Scope,
  start: Date | null,
  end: Date | null
): Promise<ReportSale[]> {
  return (await prisma.sale.findMany({
    where: {
      ...tenantWhere(scope),
      isDeleted: false,
      ...dateWhere(start, end),
    },
    select: {
      id: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      customerWhatsapp: true,
      customerAddress: true,
      invoiceNumber: true,
      grandTotal: true,
      amountPaid: true,
      amountDue: true,
      reviewAmountDue: true,
      fee: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentTerms: true,
      courierStatus: true,
      courierName: true,
      createdAt: true,
      items: {
        select: {
          quantity: true,
          totalPrice: true,
          productId: true,
          product: {
            select: { id: true, name: true, sku: true, imageUrl: true },
          },
          variant: { select: { id: true, imageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })) as unknown as ReportSale[];
}

// ─── 1. KPI strip (Reports page) ────────────────────────────

export type ReportSummary = {
  totalRevenue: number;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
};

export function summarizeSales(sales: ReportSale[]): ReportSummary {
  const successful = sales.filter(isSuccessfulSale);
  const cancelled = sales.filter(isExcludedSale);
  const totalRevenue = successful.reduce(
    (sum, s) => sum + recognizedRevenue(s),
    0
  );
  return {
    totalOrders: sales.length,
    successfulOrders: successful.length,
    cancelledOrders: cancelled.length,
    totalRevenue,
    avgOrderValue: successful.length ? totalRevenue / successful.length : 0,
  };
}

// ─── 2. Items sold (Reports page) ───────────────────────────

export type ItemsSoldRow = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  totalQuantity: number;
  totalValue: number;
};

export type ItemsSoldTotals = {
  totalQty: number;
  totalValue: number;
  returnedQty: number;
};

export function aggregateItemsSold(sales: ReportSale[]): {
  rows: ItemsSoldRow[];
  totals: ItemsSoldTotals;
} {
  const map = new Map<string, ItemsSoldRow>();
  let totalQty = 0;
  let totalValue = 0;
  let returnedQty = 0;

  for (const sale of sales) {
    const excluded = isExcludedSale(sale);
    for (const item of sale.items) {
      const qty = item.quantity ?? 0;
      const value = num(item.totalPrice);
      if (excluded) {
        returnedQty += qty;
        continue;
      }
      totalQty += qty;
      totalValue += value;

      const productId = item.productId;
      const key = productId ?? `deleted:${item.product?.name ?? "unknown"}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalValue += value;
        if (!existing.imageUrl) {
          existing.imageUrl =
            item.variant?.imageUrl ?? item.product?.imageUrl ?? null;
        }
      } else {
        map.set(key, {
          productId: key,
          productName: item.product?.name ?? "Unknown Product",
          imageUrl: item.variant?.imageUrl ?? item.product?.imageUrl ?? null,
          totalQuantity: qty,
          totalValue: value,
        });
      }
    }
  }

  return {
    rows: Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue),
    totals: { totalQty, totalValue, returnedQty },
  };
}

// ─── 3. Daily performance histogram (Reports page) ──────────

export type DailyPerfRow = {
  date: string; // "MMM dd" — e.g. "Apr 26"
  iso: string; // YYYY-MM-DD — for sorting / export
  revenue: number;
  orders: number;
  customers: number;
  avgOrder: number;
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayLabel = (d: Date) =>
  `${SHORT_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;

export async function getDailyPerformance(
  scope: Scope,
  start: Date | null,
  end: Date | null,
  preloadedSales?: ReportSale[]
): Promise<DailyPerfRow[]> {
  // The histogram needs the explicit window so empty days still appear.
  // Default to last 30 days if no bounds provided (matches the Vite spec).
  const effectiveEnd = end ?? new Date();
  const effectiveStart =
    start ?? new Date(effectiveEnd.getTime() - 29 * 24 * 60 * 60 * 1000);

  const sales =
    preloadedSales ?? (await fetchReportSales(scope, effectiveStart, effectiveEnd));

  const newCustomers = await prisma.customer.findMany({
    where: {
      ...(scope ? { tenantId: scope } : {}),
      isDeleted: false,
      createdAt: { gte: effectiveStart, lte: effectiveEnd },
    },
    select: { createdAt: true },
  });

  const buckets = new Map<
    string,
    {
      iso: string;
      label: string;
      successful: ReportSale[];
      orders: number;
      customers: number;
    }
  >();

  // Pre-seed all days in the window so the chart shows zero-bars for
  // days with no activity (otherwise Recharts would compress the X axis).
  const cursor = new Date(effectiveStart);
  cursor.setHours(0, 0, 0, 0);
  const endCursor = new Date(effectiveEnd);
  endCursor.setHours(0, 0, 0, 0);
  while (cursor <= endCursor) {
    const key = dayKey(cursor);
    buckets.set(key, {
      iso: key,
      label: dayLabel(cursor),
      successful: [],
      orders: 0,
      customers: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const sale of sales) {
    const key = dayKey(sale.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (isSuccessfulSale(sale)) bucket.successful.push(sale);
  }
  for (const c of newCustomers) {
    const key = dayKey(c.createdAt);
    const bucket = buckets.get(key);
    if (bucket) bucket.customers += 1;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((b) => {
      const revenue = b.successful.reduce(
        (sum, s) => sum + recognizedRevenue(s),
        0
      );
      return {
        iso: b.iso,
        date: b.label,
        revenue,
        orders: b.orders,
        customers: b.customers,
        avgOrder: b.orders > 0 ? revenue / b.orders : 0,
      };
    });
}

// ─── 4. Reports page — single-call composite ────────────────

export type ReportsPageData = {
  summary: ReportSummary;
  itemsSold: ItemsSoldRow[];
  itemsTotals: ItemsSoldTotals;
  daily: DailyPerfRow[];
  paymentBreakdown: { key: string; label: string; count: number; total: number }[];
};

export async function getReportsPageData(
  scope: Scope,
  start: Date | null,
  end: Date | null
): Promise<ReportsPageData> {
  const sales = await fetchReportSales(scope, start, end);
  const summary = summarizeSales(sales);
  const items = aggregateItemsSold(sales);
  const daily = await getDailyPerformance(scope, start, end, sales);

  // Payment-method breakdown across successful sales only — gives a
  // "where did the money come from" cut for the export sheet.
  const methodMap = new Map<string, { count: number; total: number }>();
  for (const sale of sales) {
    if (!isSuccessfulSale(sale)) continue;
    const key = (sale.paymentMethod || "unknown").toLowerCase();
    const row = methodMap.get(key) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total += recognizedRevenue(sale);
    methodMap.set(key, row);
  }
  const paymentBreakdown = Array.from(methodMap.entries())
    .map(([key, v]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      count: v.count,
      total: v.total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    summary,
    itemsSold: items.rows,
    itemsTotals: items.totals,
    daily,
    paymentBreakdown,
  };
}

// ═══════════════════════════════════════════════════════════════
// CASE STUDY (Sales Case Study 2026) — narrative cuts
// ═══════════════════════════════════════════════════════════════

export type CaseStudyKpi = {
  totalRevenue: number;
  totalBookedValue: number;
  totalUnits: number;
  uniqueCustomers: number;
  totalDue: number;
  avgOrderValue: number;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  conversionRate: number; // % successful / total
};

export type WeeklyRevenueRow = {
  week: string; // "MMM dd"
  iso: string; // start-of-week YYYY-MM-DD (sortable)
  revenue: number;
  orders: number;
};

export type CourierMixRow = {
  courier: string;
  revenue: number;
  orders: number;
};

export type TopCustomerRow = {
  customerId: string | null;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  orders: number;
  successfulOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  returnedCancelledOrders: number;
  units: number;
  revenue: number;
  bookedValue: number;
  pendingOrderValue: number;
  deliveredOrderValue: number;
  due: number;
  credit: number;
  averageOrderValue: number;
  lastOrderAt: string;
};

export type TopProductRow = {
  productId: string;
  productName: string;
  sku: string | null;
  imageUrl: string | null;
  unitsSold: number;
  unitsReturned: number;
  revenue: number;
  averagePrice: number;
};

export type CaseStudyData = {
  kpi: CaseStudyKpi;
  weekly: WeeklyRevenueRow[];
  courierMix: CourierMixRow[];
  topCustomers: TopCustomerRow[];
  topProducts: TopProductRow[];
  totalCustomers: number;
};

// Start-of-week (Monday) helpers, identical semantics to date-fns'
// `startOfWeek(d, { weekStartsOn: 1 })` but with no extra dependency
// surface in the service.
function startOfMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days back to Monday
  x.setDate(x.getDate() - diff);
  return x;
}

export async function getCaseStudyData(
  scope: Scope,
  start: Date | null,
  end: Date | null
): Promise<CaseStudyData> {
  const sales = await fetchReportSales(scope, start, end);

  // ── KPIs
  const successful = sales.filter(isSuccessfulSale);
  const cancelled = sales.filter(isExcludedSale);
  const totalRevenue = successful.reduce(
    (sum, s) => sum + recognizedRevenue(s),
    0
  );
  const totalBookedValue = sales.reduce((sum, s) => sum + netAmount(s), 0);
  let totalUnits = 0;
  for (const sale of sales) {
    if (isExcludedSale(sale)) continue;
    for (const item of sale.items) totalUnits += item.quantity ?? 0;
  }
  const totalDue = successful.reduce(
    (sum, s) =>
      sum + Math.max(0, num(s.reviewAmountDue ?? s.amountDue)),
    0
  );
  const customerKeys = new Set<string>();
  for (const s of sales) {
    customerKeys.add(s.customerId ?? s.customerPhone ?? s.customerName);
  }

  const kpi: CaseStudyKpi = {
    totalRevenue,
    totalBookedValue,
    totalUnits,
    uniqueCustomers: customerKeys.size,
    totalDue,
    avgOrderValue: successful.length ? totalRevenue / successful.length : 0,
    totalOrders: sales.length,
    successfulOrders: successful.length,
    cancelledOrders: cancelled.length,
    conversionRate: sales.length
      ? (successful.length / sales.length) * 100
      : 0,
  };

  // ── Weekly revenue (Mon-anchored buckets)
  const weeklyBuckets = new Map<
    string,
    { iso: string; label: string; revenue: number; orders: number }
  >();
  if (sales.length) {
    const earliest = start ?? sales[0].createdAt;
    const latest = end ?? sales[sales.length - 1].createdAt;
    const cursor = startOfMonday(earliest);
    const endCursor = startOfMonday(latest);
    while (cursor <= endCursor) {
      const key = dayKey(cursor);
      weeklyBuckets.set(key, {
        iso: key,
        label: dayLabel(cursor),
        revenue: 0,
        orders: 0,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    for (const sale of sales) {
      const weekStart = startOfMonday(sale.createdAt);
      const key = dayKey(weekStart);
      const bucket =
        weeklyBuckets.get(key) ??
        weeklyBuckets
          .set(key, {
            iso: key,
            label: dayLabel(weekStart),
            revenue: 0,
            orders: 0,
          })
          .get(key)!;
      bucket.orders += 1;
      if (isSuccessfulSale(sale)) bucket.revenue += recognizedRevenue(sale);
    }
  }
  const weekly = Array.from(weeklyBuckets.values())
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((b) => ({
      iso: b.iso,
      week: b.label,
      revenue: b.revenue,
      orders: b.orders,
    }));

  // ── Courier mix
  const courierMap = new Map<string, CourierMixRow>();
  for (const sale of successful) {
    const courier = (sale.courierName || "Direct").trim() || "Direct";
    const row =
      courierMap.get(courier) ?? { courier, revenue: 0, orders: 0 };
    row.revenue += recognizedRevenue(sale);
    row.orders += 1;
    courierMap.set(courier, row);
  }
  const courierMix = Array.from(courierMap.values()).sort(
    (a, b) => b.revenue - a.revenue
  );

  // ── Top customers (12)
  const unitsBySale = new Map<string, number>();
  for (const sale of sales) {
    let qty = 0;
    for (const item of sale.items) qty += item.quantity ?? 0;
    unitsBySale.set(sale.id, qty);
  }
  const customerAgg = new Map<string, TopCustomerRow>();
  for (const sale of sales) {
    const key =
      sale.customerId ??
      `${sale.customerPhone ?? "no-phone"}:${sale.customerName}`;
    const row =
      customerAgg.get(key) ??
      ({
        customerId: sale.customerId,
        name: sale.customerName,
        phone: sale.customerPhone,
        whatsapp: sale.customerWhatsapp,
        address: sale.customerAddress,
        orders: 0,
        successfulOrders: 0,
        deliveredOrders: 0,
        pendingOrders: 0,
        returnedCancelledOrders: 0,
        units: 0,
        revenue: 0,
        bookedValue: 0,
        pendingOrderValue: 0,
        deliveredOrderValue: 0,
        due: 0,
        credit: 0,
        averageOrderValue: 0,
        lastOrderAt: sale.createdAt.toISOString(),
      } as TopCustomerRow);

    row.orders += 1;
    row.units += unitsBySale.get(sale.id) ?? 0;
    row.bookedValue += netAmount(sale);

    const courierStatus = String(sale.courierStatus ?? "").toLowerCase();
    const paymentTerms = String(sale.paymentTerms ?? "").toLowerCase();
    const paymentMethod = String(sale.paymentMethod ?? "").toLowerCase();
    const saleDue = Math.max(0, num(sale.reviewAmountDue ?? sale.amountDue));
    const isCreditSale = paymentTerms === "credit" || paymentMethod === "credit";

    if (isSuccessfulSale(sale)) {
      row.successfulOrders += 1;
      row.revenue += recognizedRevenue(sale);
      row.due += saleDue;
      if (isCreditSale) row.credit += saleDue;
    }

    if (courierStatus === "delivered") {
      row.deliveredOrders += 1;
      row.deliveredOrderValue += netAmount(sale);
    } else if (isExcludedSale(sale)) {
      row.returnedCancelledOrders += 1;
    } else {
      row.pendingOrders += 1;
      row.pendingOrderValue += netAmount(sale);
    }

    if (new Date(sale.createdAt) > new Date(row.lastOrderAt)) {
      row.lastOrderAt = sale.createdAt.toISOString();
    }
    customerAgg.set(key, row);
  }
  const topCustomers = Array.from(customerAgg.values())
    .map((r) => ({
      ...r,
      averageOrderValue: r.successfulOrders ? r.revenue / r.successfulOrders : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, 12);

  // ── Top products (12) — successful sales only for revenue, but the
  // returned-units counter includes the excluded ones so admins can
  // see which SKUs absorb the most cancellations.
  const productAgg = new Map<string, TopProductRow>();
  for (const sale of sales) {
    const excluded = isExcludedSale(sale);
    for (const item of sale.items) {
      const key =
        item.productId ?? `deleted:${item.product?.name ?? "unknown"}`;
      const row =
        productAgg.get(key) ??
        ({
          productId: key,
          productName: item.product?.name ?? "Unknown Product",
          sku: item.product?.sku ?? null,
          imageUrl: item.variant?.imageUrl ?? item.product?.imageUrl ?? null,
          unitsSold: 0,
          unitsReturned: 0,
          revenue: 0,
          averagePrice: 0,
        } as TopProductRow);
      const qty = item.quantity ?? 0;
      if (excluded) {
        row.unitsReturned += qty;
      } else {
        row.unitsSold += qty;
        row.revenue += num(item.totalPrice);
      }
      productAgg.set(key, row);
    }
  }
  const topProducts = Array.from(productAgg.values())
    .map((r) => ({
      ...r,
      averagePrice: r.unitsSold ? r.revenue / r.unitsSold : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const totalCustomers = await prisma.customer.count({
    where: {
      ...(scope ? { tenantId: scope } : {}),
      isDeleted: false,
    },
  });

  return {
    kpi,
    weekly,
    courierMix,
    topCustomers,
    topProducts,
    totalCustomers,
  };
}
