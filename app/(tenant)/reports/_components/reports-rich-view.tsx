"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "../../_components/providers";
import { DateRangePicker } from "../../dashboard/_components/date-range-picker";
import type { ReportsPageData } from "@/lib/services/reports.service";

const PAGE_SIZE_MOBILE = 6;

export function ReportsRichView({
  data,
  rangeLabel,
  isSuperAdmin,
}: {
  data: ReportsPageData;
  rangeLabel: string;
  isSuperAdmin: boolean;
}) {
  const { formatAmount } = useCurrency();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(data.itemsSold.length / PAGE_SIZE_MOBILE)
  );
  const pagedItems = useMemo(
    () =>
      data.itemsSold.slice(
        (page - 1) * PAGE_SIZE_MOBILE,
        page * PAGE_SIZE_MOBILE
      ),
    [data.itemsSold, page]
  );

  const histogramTotals = useMemo(
    () =>
      data.daily.reduce(
        (acc, d) => ({
          revenue: acc.revenue + d.revenue,
          orders: acc.orders + d.orders,
          customers: acc.customers + d.customers,
        }),
        { revenue: 0, orders: 0, customers: 0 }
      ),
    [data.daily]
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile-only header — matches the dashboard's mobile header
          pattern. Desktop reuses the TopBar slots wired in tenant-shell. */}
      <div className="md:hidden space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <span className="text-[11px] text-muted-foreground">{rangeLabel}</span>
        </div>
        <DateRangePicker />
        <Link
          href="/reports/case-study-sales-2026"
          className="flex items-center justify-between rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <span>Case Study: Jan – Mar 2026</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* === KPI strip === */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatAmount(data.summary.totalRevenue)}
          hint="From successful orders only"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="emerald"
        />
        <KpiCard
          label="Total Orders"
          value={data.summary.totalOrders.toLocaleString()}
          hint={`${data.summary.successfulOrders.toLocaleString()} successful`}
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="indigo"
        />
        <KpiCard
          label="Cancelled Orders"
          value={data.summary.cancelledOrders.toLocaleString()}
          hint="Cancelled / returned / lost"
          icon={<XCircle className="h-4 w-4" />}
          tone="rose"
        />
        <KpiCard
          label="Avg Order Value"
          value={formatAmount(data.summary.avgOrderValue)}
          hint="Across successful orders"
          icon={<DollarSign className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      {/* === Items Sold === */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Items Sold</CardTitle>
              <CardDescription>
                Products sold within the selected date range
                {isSuperAdmin ? " (across all tenants)" : ""}
              </CardDescription>
            </div>
            <span className="text-[11px] text-muted-foreground">{rangeLabel}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat
              label="Total Sold Items"
              value={data.itemsTotals.totalQty.toLocaleString()}
              sub="Quantity sold"
            />
            <MiniStat
              label="Sold Items Value"
              value={formatAmount(data.itemsTotals.totalValue)}
              sub="Total value sold"
            />
            <MiniStat
              label="Returned Items"
              value={data.itemsTotals.returnedQty.toLocaleString()}
              sub="Cancelled / returned / lost"
              tone="rose"
            />
          </div>

          {data.itemsSold.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground/60" />}
              title="No items sold in the selected period"
              hint="Try widening the date range"
            />
          ) : (
            <>
              {/* Desktop: full grid (4 columns). Mobile: paginated single
                  column — the horizontal card layout reads cleanly even
                  at the narrowest viewport so we don't need a two-up. */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {data.itemsSold.map((item) => (
                  <ItemCard
                    key={item.productId}
                    item={item}
                    formatAmount={formatAmount}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:hidden">
                {pagedItems.map((item) => (
                  <ItemCard
                    key={item.productId}
                    item={item}
                    formatAmount={formatAmount}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between sm:hidden">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* === Business Performance Histogram === */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Business Performance Histogram
              </CardTitle>
              <CardDescription>
                Daily revenue, orders, new customers, and average order value
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <LegendChip chip="bg-[#034b28]" text={`Revenue ${formatAmount(histogramTotals.revenue)}`} />
              <LegendChip chip="bg-indigo-500" text={`Orders ${histogramTotals.orders}`} />
              <LegendChip chip="bg-amber-500" text={`Customers ${histogramTotals.customers}`} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.daily.length === 0 ? (
            <EmptyState
              icon={<TrendingDown className="h-8 w-8 text-muted-foreground/60" />}
              title="No data for the selected period"
              hint="Try adjusting the date range"
            />
          ) : (
            <>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.daily}
                    margin={{ top: 12, right: 16, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "Revenue" || name === "Avg Order") {
                          return [formatAmount(value), name];
                        }
                        return [value.toLocaleString(), name];
                      }}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#034b28" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" name="Orders" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="customers" name="New Customers" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgOrder" name="Avg Order" fill="#EC4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <FooterStat
                  label="Total Revenue"
                  value={formatAmount(histogramTotals.revenue)}
                />
                <FooterStat
                  label="Total Orders"
                  value={histogramTotals.orders.toLocaleString()}
                />
                <FooterStat
                  label="New Customers"
                  value={histogramTotals.customers.toLocaleString()}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

const TONE_CLASSES: Record<string, string> = {
  emerald: "text-[#034b28] bg-[#034b28]/10 dark:text-[#034b28]",
  indigo: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
  rose: "text-rose-600 bg-rose-500/10 dark:text-rose-400",
  amber: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${TONE_CLASSES[tone]}`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "rose";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          tone === "rose" ? "text-rose-600 dark:text-rose-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function ItemCard({
  item,
  formatAmount,
}: {
  item: { productId: string; productName: string; imageUrl: string | null; totalQuantity: number; totalValue: number };
  formatAmount: (n: number) => string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
      {/* Image — fixed 64px square on the left, won't shrink when the
          name wraps. Falls back to the package icon when there's no
          variant/product image. */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.productName}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-6 w-6 text-muted-foreground/50" />
        )}
      </div>
      {/* Right column: name + Qty row + Value row. min-w-0 lets
          truncate kick in instead of pushing the card wider. */}
      <div className="min-w-0 flex-1 space-y-1">
        <h3
          className="truncate text-sm font-semibold leading-tight"
          title={item.productName}
        >
          {item.productName}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShoppingCart className="h-3.5 w-3.5" />
          <span>Qty:</span>
          <span className="font-semibold text-foreground">
            {item.totalQuantity}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          <span>Value:</span>
          <span className="font-semibold text-[#034b28] dark:text-[#034b28]">
            {formatAmount(item.totalValue)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendChip({ chip, text }: { chip: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${chip}`} />
      {text}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/30 px-4 py-12 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
