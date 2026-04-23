import { Prisma } from "@prisma/client";
import { prisma } from "../db";

// Dashboard analytics — branches by `tenantId`.
//   null  → platform-wide (super admin sees aggregates across all tenants)
//   uuid  → tenant-scoped
//
// Time-series queries use raw SQL for efficiency (GROUP BY date_trunc).
// Numeric outputs are already JS numbers — safe to serialize to client.

type Scope = string | null;

function tenantFilter(tenantId: Scope): Prisma.SaleWhereInput {
  return tenantId ? { tenantId } : {};
}

function customerTenantFilter(tenantId: Scope): Prisma.CustomerWhereInput {
  return tenantId ? { tenantId } : {};
}

function productTenantFilter(tenantId: Scope): Prisma.ProductWhereInput {
  return tenantId ? { tenantId } : {};
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}

function formatMonthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "short" });
}

function formatDayLabel(d: Date) {
  return d.toLocaleString("en-US", { weekday: "short" });
}

// ─── 1. Today's KPI Cards ───────────────────────────────────

export type KpiCards = {
  revenueToday: number;
  revenueChangePct: number;
  ordersToday: number;
  ordersChangePct: number;
  productsSoldToday: number;
  productsSoldChangePct: number;
  newCustomersToday: number;
  newCustomersChangePct: number;
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getKpiCards(tenantId: Scope): Promise<KpiCards> {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const saleBase: Prisma.SaleWhereInput = {
    ...tenantFilter(tenantId),
    isDeleted: false,
    paymentStatus: { not: "cancelled" },
  };

  const [
    revToday,
    revYesterday,
    ordersToday,
    ordersYesterday,
    itemsToday,
    itemsYesterday,
    newCustToday,
    newCustYesterday,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...saleBase, createdAt: { gte: today, lt: tomorrow } },
      _sum: { grandTotal: true },
    }),
    prisma.sale.aggregate({
      where: { ...saleBase, createdAt: { gte: yesterday, lt: today } },
      _sum: { grandTotal: true },
    }),
    prisma.sale.count({
      where: { ...saleBase, createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.sale.count({
      where: { ...saleBase, createdAt: { gte: yesterday, lt: today } },
    }),
    prisma.saleItem.aggregate({
      where: {
        sale: { ...saleBase, createdAt: { gte: today, lt: tomorrow } },
      },
      _sum: { quantity: true },
    }),
    prisma.saleItem.aggregate({
      where: {
        sale: { ...saleBase, createdAt: { gte: yesterday, lt: today } },
      },
      _sum: { quantity: true },
    }),
    prisma.customer.count({
      where: {
        ...customerTenantFilter(tenantId),
        isDeleted: false,
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.customer.count({
      where: {
        ...customerTenantFilter(tenantId),
        isDeleted: false,
        createdAt: { gte: yesterday, lt: today },
      },
    }),
  ]);

  const revTodayN = Number(revToday._sum.grandTotal ?? 0);
  const revYesterdayN = Number(revYesterday._sum.grandTotal ?? 0);
  const itemsTodayN = Number(itemsToday._sum.quantity ?? 0);
  const itemsYesterdayN = Number(itemsYesterday._sum.quantity ?? 0);

  return {
    revenueToday: revTodayN,
    revenueChangePct: pctChange(revTodayN, revYesterdayN),
    ordersToday,
    ordersChangePct: pctChange(ordersToday, ordersYesterday),
    productsSoldToday: itemsTodayN,
    productsSoldChangePct: pctChange(itemsTodayN, itemsYesterdayN),
    newCustomersToday: newCustToday,
    newCustomersChangePct: pctChange(newCustToday, newCustYesterday),
  };
}

// ─── 2. Visitor Insights (12-month multi-line) ──────────────
// Series: loyal (customers with ≥3 orders in month), new (first purchase
// that month), unique (distinct customers with any order in month).

export type VisitorInsightsPoint = {
  month: string;
  loyal: number;
  newCust: number;
  unique: number;
};

export async function getVisitorInsights(
  tenantId: Scope
): Promise<VisitorInsightsPoint[]> {
  const end = addMonths(startOfMonth(new Date()), 1);
  const start = addMonths(end, -12);

  const tenantClause = tenantId
    ? Prisma.sql`AND s.tenant_id = ${tenantId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ month: Date; customer_id: string | null; order_count: bigint }>
  >`
    SELECT
      date_trunc('month', s.created_at) AS month,
      s.customer_id,
      COUNT(*)::bigint AS order_count
    FROM sales s
    WHERE s.is_deleted = false
      AND s.payment_status <> 'cancelled'
      AND s.created_at >= ${start}
      AND s.created_at < ${end}
      ${tenantClause}
    GROUP BY date_trunc('month', s.created_at), s.customer_id
  `;

  // First-purchase per customer (for "new" series).
  const firstRows = tenantId
    ? await prisma.$queryRaw<
        Array<{ customer_id: string; first_month: Date }>
      >`
        SELECT s.customer_id,
               date_trunc('month', MIN(s.created_at)) AS first_month
        FROM sales s
        WHERE s.is_deleted = false
          AND s.payment_status <> 'cancelled'
          AND s.customer_id IS NOT NULL
          AND s.tenant_id = ${tenantId}::uuid
        GROUP BY s.customer_id
      `
    : await prisma.$queryRaw<
        Array<{ customer_id: string; first_month: Date }>
      >`
        SELECT s.customer_id,
               date_trunc('month', MIN(s.created_at)) AS first_month
        FROM sales s
        WHERE s.is_deleted = false
          AND s.payment_status <> 'cancelled'
          AND s.customer_id IS NOT NULL
        GROUP BY s.customer_id
      `;

  const firstMonthByCustomer = new Map<string, number>();
  for (const r of firstRows) {
    firstMonthByCustomer.set(
      r.customer_id,
      new Date(r.first_month).getTime()
    );
  }

  const buckets = new Map<
    number,
    { loyal: Set<string>; newCust: number; unique: Set<string> }
  >();

  for (let i = 0; i < 12; i++) {
    const m = addMonths(start, i);
    buckets.set(m.getTime(), {
      loyal: new Set(),
      newCust: 0,
      unique: new Set(),
    });
  }

  for (const r of rows) {
    const monthTs = new Date(r.month).getTime();
    const bucket = buckets.get(monthTs);
    if (!bucket) continue;

    if (r.customer_id) {
      bucket.unique.add(r.customer_id);
      if (Number(r.order_count) >= 3) {
        bucket.loyal.add(r.customer_id);
      }
      if (firstMonthByCustomer.get(r.customer_id) === monthTs) {
        bucket.newCust += 1;
      }
    } else {
      // Walk-in (no customer_id) — count as unique visit only.
      bucket.unique.add(`walkin:${monthTs}:${Math.random()}`);
    }
  }

  const out: VisitorInsightsPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const m = addMonths(start, i);
    const b = buckets.get(m.getTime())!;
    out.push({
      month: formatMonthLabel(m),
      loyal: b.loyal.size,
      newCust: b.newCust,
      unique: b.unique.size,
    });
  }
  return out;
}

// ─── 3. Total Revenue (7-day online vs offline bar) ─────────
// offline = cash, cod, cash_on_delivery, cash-on-delivery
// online  = everything else (bkash, nagad, card, bank, etc)

const OFFLINE_METHODS = new Set([
  "cash",
  "cod",
  "cash_on_delivery",
  "cash-on-delivery",
  "offline",
]);

function isOffline(method: string) {
  return OFFLINE_METHODS.has((method || "").toLowerCase().trim());
}

export type RevenueSplitPoint = {
  day: string;
  online: number;
  offline: number;
};

export async function getTotalRevenueSplit(
  tenantId: Scope
): Promise<RevenueSplitPoint[]> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const start = addDays(today, -6);

  const rows = await prisma.sale.findMany({
    where: {
      ...tenantFilter(tenantId),
      isDeleted: false,
      paymentStatus: { not: "cancelled" },
      createdAt: { gte: start, lt: tomorrow },
    },
    select: {
      createdAt: true,
      grandTotal: true,
      paymentMethod: true,
    },
  });

  const buckets: RevenueSplitPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    buckets.push({ day: formatDayLabel(d), online: 0, offline: 0 });
  }

  for (const r of rows) {
    const idx = Math.floor(
      (startOfDay(r.createdAt).getTime() - start.getTime()) / 86_400_000
    );
    if (idx < 0 || idx > 6) continue;
    const amt = Number(r.grandTotal);
    if (isOffline(r.paymentMethod)) {
      buckets[idx].offline += amt;
    } else {
      buckets[idx].online += amt;
    }
  }

  return buckets.map((b) => ({
    day: b.day,
    online: Math.round(b.online),
    offline: Math.round(b.offline),
  }));
}

// ─── 4. Revenue Trend (this month vs last month daily) ──────

export type RevenueTrendPoint = {
  day: number; // day of month
  thisMonth: number;
  lastMonth: number;
};

export async function getRevenueTrend(
  tenantId: Scope
): Promise<RevenueTrendPoint[]> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = addMonths(thisMonthStart, 1);
  const lastMonthStart = addMonths(thisMonthStart, -1);

  const [thisRows, lastRows] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...tenantFilter(tenantId),
        isDeleted: false,
        paymentStatus: { not: "cancelled" },
        createdAt: { gte: thisMonthStart, lt: nextMonthStart },
      },
      select: { createdAt: true, grandTotal: true },
    }),
    prisma.sale.findMany({
      where: {
        ...tenantFilter(tenantId),
        isDeleted: false,
        paymentStatus: { not: "cancelled" },
        createdAt: { gte: lastMonthStart, lt: thisMonthStart },
      },
      select: { createdAt: true, grandTotal: true },
    }),
  ]);

  const daysThisMonth = new Date(
    thisMonthStart.getFullYear(),
    thisMonthStart.getMonth() + 1,
    0
  ).getDate();

  const series: RevenueTrendPoint[] = [];
  for (let d = 1; d <= daysThisMonth; d++) {
    series.push({ day: d, thisMonth: 0, lastMonth: 0 });
  }

  for (const r of thisRows) {
    const d = r.createdAt.getDate();
    if (d >= 1 && d <= daysThisMonth) {
      series[d - 1].thisMonth += Number(r.grandTotal);
    }
  }
  for (const r of lastRows) {
    const d = r.createdAt.getDate();
    if (d >= 1 && d <= daysThisMonth) {
      series[d - 1].lastMonth += Number(r.grandTotal);
    }
  }

  return series.map((p) => ({
    day: p.day,
    thisMonth: Math.round(p.thisMonth),
    lastMonth: Math.round(p.lastMonth),
  }));
}

// ─── 5. Target vs Reality (6 months grouped bars) ───────────
// Target is a simple heuristic: 1.2x the 6-month trailing average revenue
// (a realistic stretch goal derived from actual history).

export type TargetRealityPoint = {
  month: string;
  reality: number;
  target: number;
};

export async function getTargetVsReality(
  tenantId: Scope
): Promise<TargetRealityPoint[]> {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const start = addMonths(currentMonth, -5);
  const end = addMonths(currentMonth, 1);

  const tenantClause = tenantId
    ? Prisma.sql`AND tenant_id = ${tenantId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ month: Date; revenue: string | null }>
  >`
    SELECT date_trunc('month', created_at) AS month,
           COALESCE(SUM(grand_total), 0)::text AS revenue
    FROM sales
    WHERE is_deleted = false
      AND payment_status <> 'cancelled'
      AND created_at >= ${start}
      AND created_at < ${end}
      ${tenantClause}
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at)
  `;

  const byMonth = new Map<number, number>();
  for (const r of rows) {
    byMonth.set(new Date(r.month).getTime(), Number(r.revenue ?? 0));
  }

  const realityVals: number[] = [];
  for (let i = 0; i < 6; i++) {
    const m = addMonths(start, i);
    realityVals.push(byMonth.get(m.getTime()) ?? 0);
  }

  const avg = realityVals.reduce((s, v) => s + v, 0) / 6 || 0;
  const target = Math.round(avg * 1.2);

  return realityVals.map((reality, i) => ({
    month: formatMonthLabel(addMonths(start, i)),
    reality: Math.round(reality),
    target,
  }));
}

// ─── 6. Top Products (ranked by revenue this month) ─────────

export type TopProductItem = {
  id: string;
  name: string;
  revenue: number;
  percent: number; // of top item
  imageUrl: string | null;
};

export async function getTopProducts(
  tenantId: Scope,
  limit = 5
): Promise<TopProductItem[]> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = addMonths(thisMonthStart, 1);

  const grouped = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      sale: {
        ...tenantFilter(tenantId),
        isDeleted: false,
        paymentStatus: { not: "cancelled" },
        createdAt: { gte: thisMonthStart, lt: nextMonthStart },
      },
    },
    _sum: { totalPrice: true },
    orderBy: { _sum: { totalPrice: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const productIds = grouped
    .map((g) => g.productId)
    .filter((id): id is string => !!id);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, imageUrl: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const top = Number(grouped[0]._sum.totalPrice ?? 0) || 1;

  return grouped
    .filter((g) => g.productId && byId.has(g.productId))
    .map((g) => {
      const p = byId.get(g.productId!)!;
      const rev = Number(g._sum.totalPrice ?? 0);
      return {
        id: p.id,
        name: p.name,
        revenue: Math.round(rev),
        percent: Math.round((rev / top) * 100),
        imageUrl: p.imageUrl,
      };
    });
}

// ─── 7. Volume vs Service Level (6 months) ──────────────────
// volume = total orders placed / 100 (normalized)
// service = % of those orders that reached "delivered" state

export type VolumeServicePoint = {
  month: string;
  volume: number;
  service: number;
};

export async function getVolumeVsService(
  tenantId: Scope
): Promise<VolumeServicePoint[]> {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const start = addMonths(currentMonth, -5);
  const end = addMonths(currentMonth, 1);

  const tenantClause = tenantId
    ? Prisma.sql`AND tenant_id = ${tenantId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ month: Date; placed: bigint; delivered: bigint }>
  >`
    SELECT date_trunc('month', created_at) AS month,
           COUNT(*)::bigint AS placed,
           COUNT(*) FILTER (
             WHERE order_status IN ('delivered', 'completed')
                OR courier_status IN ('delivered')
           )::bigint AS delivered
    FROM sales
    WHERE is_deleted = false
      AND created_at >= ${start}
      AND created_at < ${end}
      ${tenantClause}
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at)
  `;

  const byMonth = new Map<number, { placed: number; delivered: number }>();
  for (const r of rows) {
    byMonth.set(new Date(r.month).getTime(), {
      placed: Number(r.placed),
      delivered: Number(r.delivered),
    });
  }

  return Array.from({ length: 6 }).map((_, i) => {
    const m = addMonths(start, i);
    const v = byMonth.get(m.getTime()) ?? { placed: 0, delivered: 0 };
    const servicePct = v.placed > 0 ? (v.delivered / v.placed) * 100 : 0;
    return {
      month: formatMonthLabel(m),
      volume: v.placed,
      service: Math.round(servicePct * 10) / 10,
    };
  });
}

// ─── 8. Sales by Region (Bangladesh divisions choropleth) ───
// Aggregates sales revenue into Bangladesh's 8 administrative divisions
// by mapping the sale.city / customerAddress string to a division.

export type BdDivision =
  | "dhaka"
  | "chattogram"
  | "khulna"
  | "rajshahi"
  | "barishal"
  | "sylhet"
  | "rangpur"
  | "mymensingh";

export type SalesByRegionPoint = {
  division: BdDivision;
  label: string;
  revenue: number;
  orders: number;
  percent: number; // of top division
};

// City/district → division. Common BD city spellings are folded in.
// Keys are lowercased before lookup.
const CITY_TO_DIVISION: Record<string, BdDivision> = {
  // Dhaka division
  dhaka: "dhaka",
  gazipur: "dhaka",
  narayanganj: "dhaka",
  tangail: "dhaka",
  manikganj: "dhaka",
  narsingdi: "dhaka",
  munshiganj: "dhaka",
  faridpur: "dhaka",
  gopalganj: "dhaka",
  madaripur: "dhaka",
  rajbari: "dhaka",
  shariatpur: "dhaka",
  kishoreganj: "dhaka",
  savar: "dhaka",
  uttara: "dhaka",
  mirpur: "dhaka",
  mohammadpur: "dhaka",
  dhanmondi: "dhaka",
  gulshan: "dhaka",
  banani: "dhaka",
  badda: "dhaka",
  motijheel: "dhaka",

  // Chattogram division
  chattogram: "chattogram",
  chittagong: "chattogram",
  "cox's bazar": "chattogram",
  "coxs bazar": "chattogram",
  "cox bazar": "chattogram",
  rangamati: "chattogram",
  bandarban: "chattogram",
  khagrachari: "chattogram",
  khagrachhari: "chattogram",
  noakhali: "chattogram",
  feni: "chattogram",
  lakshmipur: "chattogram",
  laxmipur: "chattogram",
  comilla: "chattogram",
  cumilla: "chattogram",
  chandpur: "chattogram",
  brahmanbaria: "chattogram",
  "b-baria": "chattogram",

  // Khulna division
  khulna: "khulna",
  jessore: "khulna",
  jashore: "khulna",
  satkhira: "khulna",
  bagerhat: "khulna",
  kushtia: "khulna",
  chuadanga: "khulna",
  jhenaidah: "khulna",
  magura: "khulna",
  narail: "khulna",
  meherpur: "khulna",

  // Barishal division
  barishal: "barishal",
  barisal: "barishal",
  patuakhali: "barishal",
  barguna: "barishal",
  jhalokati: "barishal",
  jhalokathi: "barishal",
  bhola: "barishal",
  pirojpur: "barishal",

  // Sylhet division
  sylhet: "sylhet",
  moulvibazar: "sylhet",
  maulvibazar: "sylhet",
  habiganj: "sylhet",
  sunamganj: "sylhet",

  // Rajshahi division
  rajshahi: "rajshahi",
  bogura: "rajshahi",
  bogra: "rajshahi",
  naogaon: "rajshahi",
  natore: "rajshahi",
  chapainawabganj: "rajshahi",
  "chapai nawabganj": "rajshahi",
  pabna: "rajshahi",
  sirajganj: "rajshahi",
  joypurhat: "rajshahi",

  // Rangpur division
  rangpur: "rangpur",
  dinajpur: "rangpur",
  gaibandha: "rangpur",
  nilphamari: "rangpur",
  lalmonirhat: "rangpur",
  kurigram: "rangpur",
  panchagarh: "rangpur",
  thakurgaon: "rangpur",

  // Mymensingh division
  mymensingh: "mymensingh",
  jamalpur: "mymensingh",
  sherpur: "mymensingh",
  netrokona: "mymensingh",
  netrakona: "mymensingh",
};

const DIVISION_LABELS: Record<BdDivision, string> = {
  dhaka: "Dhaka",
  chattogram: "Chattogram",
  khulna: "Khulna",
  rajshahi: "Rajshahi",
  barishal: "Barishal",
  sylhet: "Sylhet",
  rangpur: "Rangpur",
  mymensingh: "Mymensingh",
};

function resolveDivision(raw: string | null | undefined): BdDivision | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (CITY_TO_DIVISION[s]) return CITY_TO_DIVISION[s];

  // Substring match — customerAddress often contains the city name
  // surrounded by other text ("House 12, Dhaka, Bangladesh").
  for (const key of Object.keys(CITY_TO_DIVISION)) {
    if (s.includes(key)) return CITY_TO_DIVISION[key];
  }
  return null;
}

export async function getSalesByRegion(
  tenantId: Scope
): Promise<SalesByRegionPoint[]> {
  const rows = await prisma.sale.findMany({
    where: {
      ...tenantFilter(tenantId),
      isDeleted: false,
      paymentStatus: { not: "cancelled" },
    },
    select: {
      grandTotal: true,
      city: true,
      customerAddress: true,
    },
  });

  const buckets = new Map<BdDivision, { revenue: number; orders: number }>();
  (Object.keys(DIVISION_LABELS) as BdDivision[]).forEach((d) =>
    buckets.set(d, { revenue: 0, orders: 0 })
  );

  for (const r of rows) {
    const div = resolveDivision(r.city) ?? resolveDivision(r.customerAddress);
    if (!div) continue;
    const b = buckets.get(div)!;
    b.revenue += Number(r.grandTotal);
    b.orders += 1;
  }

  const topRevenue = Math.max(
    ...Array.from(buckets.values()).map((b) => b.revenue),
    1
  );

  return (Object.keys(DIVISION_LABELS) as BdDivision[]).map((div) => {
    const b = buckets.get(div)!;
    return {
      division: div,
      label: DIVISION_LABELS[div],
      revenue: Math.round(b.revenue),
      orders: b.orders,
      percent: Math.round((b.revenue / topRevenue) * 100),
    };
  });
}

// ─── Platform-wide counters (super admin only) ──────────────

export type PlatformCounters = {
  totalTenants: number;
  pendingRequests: number;
  totalUsers: number;
};

export async function getPlatformCounters(): Promise<PlatformCounters> {
  const [totalTenants, pendingRequests, totalUsers] = await Promise.all([
    prisma.tenant.count(),
    prisma.demoRequest.count({ where: { status: "pending" } }),
    prisma.user.count(),
  ]);
  return { totalTenants, pendingRequests, totalUsers };
}

// ─── Convenience: fetch everything in parallel ──────────────

export async function getDashboardAnalytics(tenantId: Scope) {
  const [
    kpi,
    visitorInsights,
    totalRevenue,
    revenueTrend,
    targetVsReality,
    topProducts,
    salesByRegion,
    volumeVsService,
  ] = await Promise.all([
    getKpiCards(tenantId),
    getVisitorInsights(tenantId),
    getTotalRevenueSplit(tenantId),
    getRevenueTrend(tenantId),
    getTargetVsReality(tenantId),
    getTopProducts(tenantId, 5),
    getSalesByRegion(tenantId),
    getVolumeVsService(tenantId),
  ]);

  return {
    kpi,
    visitorInsights,
    totalRevenue,
    revenueTrend,
    targetVsReality,
    topProducts,
    salesByRegion,
    volumeVsService,
  };
}

// Silence unused-var warning for the product filter helper (kept for parity).
void productTenantFilter;
