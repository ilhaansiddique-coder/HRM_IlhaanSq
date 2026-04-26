"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  CalendarRange,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "../../../_components/providers";
import type { CaseStudyData, TopCustomerRow } from "@/lib/services/reports.service";

const shorten = (v: string | null | undefined, max = 24): string => {
  const t = String(v ?? "").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…` : t;
};

export function CaseStudyView({
  data,
  rangeLabel,
  isSuperAdmin,
}: {
  data: CaseStudyData;
  rangeLabel: string;
  isSuperAdmin: boolean;
}) {
  const { formatAmount } = useCurrency();
  const { kpi, weekly, courierMix, topCustomers, topProducts } = data;
  const top3 = topCustomers.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* === Hero === */}
      <Card className="border-border/70 bg-gradient-to-br from-emerald-500/10 via-card/80 to-indigo-500/10">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                Sales Case Study
              </Badge>
              <CardTitle className="text-2xl md:text-3xl font-semibold tracking-tight">
                Jan – Mar 2026 Performance Review
              </CardTitle>
              <CardDescription className="max-w-2xl">
                A narrative cut of the period: revenue rhythm, courier mix, and
                the customers + products that drove the quarter
                {isSuperAdmin ? " across all tenants" : ""}.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Reports
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip icon={<CalendarRange className="h-3 w-3" />} text={rangeLabel} />
            <Chip
              icon={<ShoppingBag className="h-3 w-3" />}
              text={`${kpi.totalOrders.toLocaleString()} orders`}
            />
            <Chip
              icon={<Users className="h-3 w-3" />}
              text={`${kpi.uniqueCustomers.toLocaleString()} customers`}
            />
            <Chip
              icon={<TrendingUp className="h-3 w-3" />}
              text={`${kpi.conversionRate.toFixed(1)}% success rate`}
            />
          </div>
        </CardHeader>
      </Card>

      {/* === KPIs === */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BigKpi
          label="Recognized Revenue"
          value={formatAmount(kpi.totalRevenue)}
          hint="From successful orders only"
          tone="emerald"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <BigKpi
          label="Booked Order Value"
          value={formatAmount(kpi.totalBookedValue)}
          hint="Gross — includes pending and cancelled"
          tone="indigo"
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <BigKpi
          label="Units Realized"
          value={kpi.totalUnits.toLocaleString()}
          hint={`${kpi.successfulOrders.toLocaleString()} successful orders`}
          tone="amber"
          icon={<Package className="h-4 w-4" />}
        />
        <BigKpi
          label="Avg Order Value"
          value={formatAmount(kpi.avgOrderValue)}
          hint={`${formatAmount(kpi.totalDue)} still outstanding`}
          tone="rose"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* === Charts row === */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly area chart — 2/3 width on desktop */}
        <Card className="border-border/70 bg-card/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Weekly Revenue Rhythm</CardTitle>
            <CardDescription>
              Recognized revenue per ISO week (Mon-anchored)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {weekly.length === 0 ? (
              <EmptyState text="No weekly data in the selected window" />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={weekly}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="csRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="week"
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
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number, name: string) =>
                        name === "Revenue"
                          ? [formatAmount(v), name]
                          : [v.toLocaleString(), name]
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#csRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Courier mix horizontal bar */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Courier Revenue Mix</CardTitle>
            <CardDescription>Where the dispatched revenue went</CardDescription>
          </CardHeader>
          <CardContent>
            {courierMix.length === 0 ? (
              <EmptyState text="No courier-tagged sales in the window" />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={courierMix}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="courier"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      width={80}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => formatAmount(v)}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#6366F1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Top customers — top-3 cards + ranked table === */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Top Customers</CardTitle>
          <CardDescription>
            Ranked by recognized revenue. Top 12 in the window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {top3.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {top3.map((c, i) => (
                <TopCustomerCard
                  key={`${c.customerId ?? c.name}:${i}`}
                  rank={i + 1}
                  customer={c}
                  formatAmount={formatAmount}
                />
              ))}
            </div>
          )}

          {topCustomers.length === 0 ? (
            <EmptyState text="No customers in this window" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((c, i) => (
                    <TableRow key={`${c.customerId ?? c.name}:${i}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium leading-tight">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {shorten(c.phone ?? c.whatsapp ?? c.address, 32)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {c.orders}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {c.units}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatAmount(c.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatAmount(c.averageOrderValue)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm tabular-nums ${
                          c.due > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        }`}
                      >
                        {formatAmount(c.due)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === Top products === */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Top Products</CardTitle>
          <CardDescription>By revenue. Top 12 in the window.</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <EmptyState text="No products sold in this window" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={p.productId}>
                      <TableCell className="text-xs text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.imageUrl}
                                alt={p.productName}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground/60" />
                            )}
                          </div>
                          <span className="font-medium leading-tight">
                            {p.productName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.sku ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {p.unitsSold}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm tabular-nums ${
                          p.unitsReturned > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {p.unitsReturned}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatAmount(p.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatAmount(p.averagePrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

const BIG_KPI_TONES: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  indigo: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
  amber: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  rose: "text-rose-600 bg-rose-500/10 dark:text-rose-400",
};

function BigKpi({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof BIG_KPI_TONES;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${BIG_KPI_TONES[tone]}`}
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

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {icon}
      {text}
    </span>
  );
}

function TopCustomerCard({
  rank,
  customer,
  formatAmount,
}: {
  rank: number;
  customer: TopCustomerRow;
  formatAmount: (n: number) => string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <Badge variant="outline" className="text-[10px]">
          #{rank}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {customer.successfulOrders}/{customer.orders} successful
        </span>
      </div>
      <div className="font-semibold leading-tight">{customer.name}</div>
      <div className="text-[11px] text-muted-foreground">
        {shorten(customer.phone ?? customer.whatsapp ?? customer.address, 40)}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
        <div>
          <p className="text-muted-foreground">Revenue</p>
          <p className="font-semibold">{formatAmount(customer.revenue)}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Units</p>
          <p className="font-semibold">{customer.units}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-background/30 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
