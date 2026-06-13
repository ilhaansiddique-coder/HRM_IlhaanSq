import { requireTenant } from "@/lib/auth";
import {
  getDashboardAnalytics,
  getPlatformCounters,
} from "@/lib/services/dashboard-analytics.service";
import { getRecentNotifications } from "@/lib/services/notifications.service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Inbox, Users } from "lucide-react";
import { MobileDashboardHeader } from "./_components/mobile-dashboard-header";
import { HrOverview } from "./_components/hr-overview";

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

      {platform ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <PlatformCard
            icon={<Building2 className="h-4 w-4" />}
            label="Total Tenants"
            value={platform.totalTenants}
          />
          <PlatformCard
            icon={<Inbox className="h-4 w-4" />}
            label="Pending Requests"
            value={platform.pendingRequests}
          />
          <PlatformCard
            icon={<Users className="h-4 w-4" />}
            label="Total Users"
            value={platform.totalUsers}
          />
        </div>
      ) : (
        <HrOverview data={analytics} />
      )}
    </div>
  );
}

function PlatformCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
