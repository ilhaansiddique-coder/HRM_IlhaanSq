"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "../../_components/providers";
import { Package, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ReportsView({
  revenueData,
  topProducts,
  paymentBreakdown,
}: {
  revenueData: { date: string; revenue: number }[];
  topProducts: any[];
  paymentBreakdown: { status: string; count: number; total: number }[];
}) {
  const { formatAmount } = useCurrency();

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const peakDay = revenueData.reduce(
    (max, d) => (d.revenue > max.revenue ? d : max),
    revenueData[0] ?? { date: "", revenue: 0 }
  );
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">30-Day Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatAmount(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peak Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatAmount(peakDay.revenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{peakDay.date || "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatAmount(totalRevenue / Math.max(revenueData.length, 1))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart (CSS bar chart, no external dep needed) */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Daily Revenue
          </CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-48 overflow-x-auto">
            {revenueData.map((d) => {
              const heightPct = (d.revenue / maxRevenue) * 100;
              return (
                <div
                  key={d.date}
                  className="flex flex-col items-center gap-1 min-w-[14px] flex-1 group relative"
                  title={`${d.date}: ${formatAmount(d.revenue)}`}
                >
                  <div
                    className="w-full bg-primary/70 hover:bg-primary rounded-t transition-colors"
                    style={{ height: `${heightPct}%`, minHeight: d.revenue > 0 ? "2px" : "0" }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{revenueData[0]?.date}</span>
            <span>{revenueData[revenueData.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: top products + payment breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Desktop: table view. Mobile uses the card stack below. */}
        <Card className="hidden md:block border-border/70 bg-card/80 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Top Products
            </CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((item, i) => (
                    <TableRow key={item.product?.id ?? i}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                          <span className="font-medium">{item.product?.name ?? "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantitySold}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(item.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Mobile: top products card stack — rank + name header,
            sold count + revenue row. */}
        <div className="md:hidden space-y-3">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold">
              <Package className="h-5 w-5 text-primary" />
              Top Products
            </p>
            <p className="text-xs text-muted-foreground">By revenue</p>
          </div>
          {topProducts.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Package className="h-8 w-8 opacity-40" />
              <span className="text-sm">No sales data yet</span>
            </Card>
          ) : (
            topProducts.map((item, i) => (
              <Card
                key={item.product?.id ?? i}
                className="rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1 break-words font-medium leading-tight">
                    {item.product?.name ?? "Unknown"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Sold: </span>
                    <span className="font-semibold">{item.quantitySold}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Revenue: </span>
                    <span className="font-semibold">
                      {formatAmount(item.revenue)}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Payment Breakdown</CardTitle>
            <CardDescription>By status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              paymentBreakdown.map((p) => (
                <div key={p.status} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{p.status}</Badge>
                    <span className="text-xs text-muted-foreground">{p.count} order{p.count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="font-medium">{formatAmount(p.total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
