import { requireTenant } from "@/lib/auth";
import {
  getDashboardAnalytics,
  getPlatformCounters,
} from "@/lib/services/dashboard-analytics.service";
import { DashboardToolbar } from "./_components/dashboard-toolbar";
import { KpiCardsRow } from "./_components/kpi-cards";
import { VisitorInsightsChart } from "./_components/visitor-insights-chart";
import { TotalRevenueChart } from "./_components/total-revenue-chart";
import { RevenueTrendChart } from "./_components/revenue-trend-chart";
import { TargetRealityChart } from "./_components/target-reality-chart";
import { TopProductsList } from "./_components/top-products-list";
import { SalesMapChart } from "./_components/sales-map-chart";
import { VolumeServiceChart } from "./_components/volume-service-chart";

export default async function DashboardPage() {
  const session = await requireTenant();
  const scope = session.isSuperAdmin ? null : session.tenantId;

  const [analytics, platform] = await Promise.all([
    getDashboardAnalytics(scope),
    session.isSuperAdmin ? getPlatformCounters() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {session.name}
          {session.isSuperAdmin && platform && (
            <span className="ml-2 text-xs text-muted-foreground">
              · {platform.totalTenants} tenants · {platform.totalUsers} users
              {platform.pendingRequests > 0 &&
                ` · ${platform.pendingRequests} pending request${
                  platform.pendingRequests !== 1 ? "s" : ""
                }`}
            </span>
          )}
        </p>
      </div>

      <DashboardToolbar />

      {/* Row 1 — KPI cards (left, 2/3) + Visitor Insights (right, 1/3 on xl, stack below) */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <KpiCardsRow kpi={analytics.kpi} />
        </div>
        <div className="xl:col-span-1">
          <VisitorInsightsChart data={analytics.visitorInsights} />
        </div>
      </div>

      {/* Row 2 — Total Revenue + Revenue Trend + Target vs Reality */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <TotalRevenueChart data={analytics.totalRevenue} />
        <RevenueTrendChart data={analytics.revenueTrend} />
        <TargetRealityChart data={analytics.targetVsReality} />
      </div>

      {/* Row 3 — Top Products + Sales Map (Bangladesh) + Volume vs Service */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <TopProductsList items={analytics.topProducts} />
        <SalesMapChart data={analytics.salesByRegion} />
        <VolumeServiceChart data={analytics.volumeVsService} />
      </div>
    </div>
  );
}
