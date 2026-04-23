import { requireTenant } from "@/lib/auth";
import { getCachedDashboard } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { DashboardCards } from "./_components/dashboard-cards";
import { DashboardToolbar } from "./_components/dashboard-toolbar";

export default async function DashboardPage() {
  const session = await requireTenant();

  const [metrics, totalTenants, pendingTenantRequests] = await Promise.all([
    getCachedDashboard(session.tenantId),
    // Only fetch platform metrics if user is super admin
    session.isSuperAdmin ? prisma.tenant.count() : Promise.resolve(0),
    session.isSuperAdmin
      ? prisma.demoRequest.count({ where: { status: "pending" } })
      : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {session.name}
        </p>
      </div>

      <DashboardToolbar />

      <DashboardCards
        metrics={metrics}
        platformMetrics={
          session.isSuperAdmin
            ? { totalTenants, pendingTenantRequests }
            : undefined
        }
      />
    </div>
  );
}
