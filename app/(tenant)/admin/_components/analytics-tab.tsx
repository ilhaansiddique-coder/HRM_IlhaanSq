"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "../../_components/providers";
import { ArrowUp, ArrowDown, DollarSign, ShoppingCart, Users, TrendingUp, Calendar } from "lucide-react";
type PeriodMetric = {
  label: string;
  current: number;
  previous: number;
  changePercent: number;
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  sale: <ShoppingCart className="h-4 w-4 text-primary" />,
  product: <TrendingUp className="h-4 w-4 text-info" />,
  customer: <Users className="h-4 w-4 text-secondary" />,
};

const ACTION_LABELS: Record<string, string> = {
  create: "New",
  update: "Updated",
  delete: "Deleted",
};

export function AnalyticsTab({
  analytics,
  recentActivity,
}: {
  analytics: {
    revenue: PeriodMetric;
    orders: PeriodMetric;
    customers: PeriodMetric;
    profit: PeriodMetric;
  };
  recentActivity: any[];
}) {
  const { formatAmount } = useCurrency();

  const cards = [
    {
      metric: analytics.revenue,
      icon: <DollarSign className="h-4 w-4" />,
      formatter: (v: number) => formatAmount(v),
    },
    {
      metric: analytics.orders,
      icon: <ShoppingCart className="h-4 w-4" />,
      formatter: (v: number) => v.toLocaleString(),
    },
    {
      metric: analytics.customers,
      icon: <Users className="h-4 w-4" />,
      formatter: (v: number) => v.toLocaleString(),
    },
    {
      metric: analytics.profit,
      icon: <DollarSign className="h-4 w-4" />,
      formatter: (v: number) => formatAmount(v),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ metric, icon, formatter }) => {
          const positive = metric.changePercent >= 0;
          return (
            <Card key={metric.label} className="border-border/70 bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {icon}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatter(metric.current)}</div>
                <div
                  className={`flex items-center gap-1 mt-1 text-xs ${
                    positive ? "text-success" : "text-destructive"
                  }`}
                >
                  {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <span>
                    {Math.abs(metric.changePercent).toFixed(1)}% from last period
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest business activities across the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No recent activity
            </p>
          ) : (
            recentActivity.map((log) => {
              const icon = ENTITY_ICONS[log.entityType] ?? (
                <Calendar className="h-4 w-4 text-muted-foreground" />
              );
              const actionLabel = ACTION_LABELS[log.action] ?? log.action;
              const description =
                log.action === "create" && log.entityType === "sale"
                  ? `Sale to ${(log.details as any)?.customerName ?? "customer"}`
                  : log.action === "create" && log.entityType === "customer"
                    ? `New customer: ${(log.details as any)?.name ?? "customer"}`
                    : `${actionLabel} ${log.entityType}`;

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {log.entityType === "sale" && (log.details as any)?.amount && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium">
                        {formatAmount((log.details as any).amount)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                        {log.entityType}
                      </span>
                    </div>
                  )}
                  {log.entityType !== "sale" && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary flex-shrink-0">
                      {log.entityType}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
