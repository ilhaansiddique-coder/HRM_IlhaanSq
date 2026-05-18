import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
} from "lucide-react";

type ReportSummary = {
  totalRevenue: number;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
};

type Reports = {
  summary: ReportSummary;
  paymentBreakdown: { key: string; label: string; count: number; total: number }[];
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Kpi({
  icon,
  title,
  value,
  variant,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  variant?: "success" | "destructive";
}) {
  const bg =
    variant === "success"
      ? "bg-success/10 text-success"
      : variant === "destructive"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function ReportsTab({ reports }: { reports: Reports }) {
  const s = reports.summary;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<DollarSign className="h-4 w-4" />} title="Total Revenue" value={fmt(s.totalRevenue)} />
        <Kpi icon={<ShoppingCart className="h-4 w-4" />} title="Total Orders" value={fmt(s.totalOrders)} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} title="Successful" value={fmt(s.successfulOrders)} variant="success" />
        <Kpi icon={<XCircle className="h-4 w-4" />} title="Cancelled" value={fmt(s.cancelledOrders)} variant="destructive" />
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Reports
          </CardTitle>
          <Link href="/reports">
            <Button size="sm" variant="outline" className="gap-1">
              Open full reports
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">Average order value</p>
              <p className="text-lg font-semibold">{fmt(s.avgOrderValue)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">Fulfilment rate</p>
              <p className="text-lg font-semibold">
                {s.totalOrders > 0
                  ? `${Math.round((s.successfulOrders / s.totalOrders) * 100)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {reports.paymentBreakdown.length > 0 && (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-medium">
                Payment breakdown
              </div>
              <div className="divide-y divide-border/60">
                {reports.paymentBreakdown.map((p) => (
                  <div
                    key={p.key}
                    className="flex items-center justify-between px-3 py-2 text-xs"
                  >
                    <span className="capitalize">{p.label}</span>
                    <span className="text-muted-foreground">
                      {p.count} · {fmt(p.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This is a snapshot. Use{" "}
            <Link href="/reports" className="text-primary underline">
              full reports
            </Link>{" "}
            for date-range filtering and XLSX export.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
