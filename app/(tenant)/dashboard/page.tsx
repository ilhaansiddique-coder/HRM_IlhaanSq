import { requireTenant } from "@/lib/auth";
import {
  getDashboardAnalytics,
  getPlatformCounters,
} from "@/lib/services/dashboard-analytics.service";
import { getRecentNotifications } from "@/lib/services/notifications.service";
import { KpiCardsRow } from "./_components/kpi-cards";
import { MobileDashboardHeader } from "./_components/mobile-dashboard-header";
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

  const [analytics, platform, notifications] = await Promise.all([
    getDashboardAnalytics(scope),
    session.isSuperAdmin ? getPlatformCounters() : Promise.resolve(null),
    // The mobile dashboard header renders its own NotificationBell since
    // the global TopBar is hidden on mobile — fetch the same set the
    // TopBar uses so the bell shows accurate unread counts.
    getRecentNotifications(scope, session.userId, 12),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile-only dashboard header — title + Today + 4 quick-action cards */}
      <MobileDashboardHeader notifications={notifications} />

      {/* Row 1 — KPI cards (left, 2/3) + Visitor Insights (right, 1/3 on xl, stack below) */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <KpiCardsRow
            kpi={analytics.kpi}
            platformMetrics={platform ?? undefined}
          />
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
        <SalesMapChart data={analytics.salesByDistrict} />
        <VolumeServiceChart data={analytics.volumeVsService} />
      </div>
    </div>
  );
}
