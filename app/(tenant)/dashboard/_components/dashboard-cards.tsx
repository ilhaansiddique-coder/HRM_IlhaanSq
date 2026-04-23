"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Banknote,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";
import type { DashboardMetrics } from "@/lib/cache";
import { useCurrency } from "../../_components/providers";

type PlatformMetrics = {
  totalTenants: number;
  pendingTenantRequests: number;
};

export function DashboardCards({
  metrics,
  platformMetrics,
}: {
  metrics: DashboardMetrics;
  platformMetrics?: PlatformMetrics;
}) {
  const { formatAmount } = useCurrency();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Hero revenue card + key metrics. 5 columns when super admin shows platform metric. */}
      <div
        className={`grid gap-4 sm:grid-cols-2 ${
          platformMetrics ? "lg:grid-cols-5" : "lg:grid-cols-4"
        }`}
      >
        <Card className="relative overflow-hidden border-primary/30 bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/85">
              Today's Revenue
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
              <DollarSign className="h-4 w-4 text-primary-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">
              {formatAmount(metrics.todayRevenue)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-primary-foreground/75">
              {metrics.todaySales} order{metrics.todaySales !== 1 ? "s" : ""} today
            </div>
          </CardContent>
        </Card>

        {/* SUPER ADMIN ONLY: Total Tenants — clickable, navigates to /tenants */}
        {platformMetrics && (
          <Link href="/tenants" className="block">
            <Card className="relative overflow-hidden border-accent/40 bg-gradient-to-br from-accent/15 via-card to-card hover:shadow-md transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tenants
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Building2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold">
                  {platformMetrics.totalTenants.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {platformMetrics.pendingTenantRequests > 0 ? (
                    <>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      {platformMetrics.pendingTenantRequests} pending request
                      {platformMetrics.pendingTenantRequests !== 1 ? "s" : ""}
                    </>
                  ) : (
                    "All tenants on platform"
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        <MetricCard
          title="Total Revenue"
          icon={<TrendingUp className="h-4 w-4" />}
          value={formatAmount(metrics.totalRevenue)}
          hint="All time revenue"
        />
        <MetricCard
          title="Total Sales"
          icon={<ShoppingCart className="h-4 w-4" />}
          value={metrics.totalSales.toLocaleString()}
          hint="Orders placed"
        />
        <MetricCard
          title="Pending Orders"
          icon={<Clock className="h-4 w-4" />}
          value={metrics.pendingOrders.toLocaleString()}
          hint="Need attention"
          variant={metrics.pendingOrders > 0 ? "warning" : "default"}
        />
      </div>

      {/* Inventory + customer stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Products"
          icon={<Package className="h-4 w-4" />}
          value={metrics.totalProducts.toLocaleString()}
          hint="In catalog"
        />
        <MetricCard
          title="Low Stock"
          icon={<AlertTriangle className="h-4 w-4" />}
          value={metrics.lowStockProducts.toLocaleString()}
          hint="Below threshold"
          variant={metrics.lowStockProducts > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="Total Customers"
          icon={<Users className="h-4 w-4" />}
          value={metrics.totalCustomers.toLocaleString()}
          hint="Total customers"
        />
        <MetricCard
          title="Today's Orders"
          icon={<Banknote className="h-4 w-4" />}
          value={metrics.todaySales.toLocaleString()}
          hint="Created today"
        />
      </div>

      {/* Two-column lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest transactions</CardDescription>
            </div>
            <a
              href="/sales"
              className="hidden text-xs text-primary hover:underline md:inline-flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Recent sales will appear here
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best performers</CardDescription>
            </div>
            <a
              href="/products"
              className="hidden text-xs text-primary hover:underline md:inline-flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Top sellers will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert tiles */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-warning/35 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Warnings
            </CardTitle>
            <CardDescription>Things needing attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {metrics.lowStockProducts > 0 ? (
              <div className="flex items-start gap-3 rounded-lg bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">
                    {metrics.lowStockProducts} product
                    {metrics.lowStockProducts !== 1 ? "s" : ""} low on stock
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Restock soon to avoid stockouts
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No warnings</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/35 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-5 w-5 text-destructive" />
              Critical
            </CardTitle>
            <CardDescription>Items needing urgent action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="text-center py-6">
              <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All good</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  hint,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  hint: string;
  variant?: "default" | "warning" | "success";
}) {
  const iconWrap =
    variant === "warning"
      ? "bg-warning/12 text-warning"
      : variant === "success"
        ? "bg-success/12 text-success"
        : "bg-primary/10 text-primary";

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${iconWrap}`}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div
          className={`text-2xl font-semibold ${
            variant === "warning" ? "text-warning" : ""
          }`}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}
