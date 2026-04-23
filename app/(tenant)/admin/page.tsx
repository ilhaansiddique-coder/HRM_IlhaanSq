import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { getAdminAnalytics, getRecentActivity } from "@/lib/services/analytics.service";
import {
  listTenantUsers,
  listActivityLogs,
  listCourierProviders,
  getAllRolePermissions,
} from "@/lib/services/admin-users.service";
import { getSystemStats } from "@/lib/services/backup.service";
import {
  getCachedSystemSettings,
  getCachedBusinessSettings,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { AdminTabs } from "./_components/admin-tabs";

export default async function AdminPage() {
  const session = await requireTenant();
  if (!["owner", "admin", "superadmin"].includes(session.role ?? "")) {
    redirect("/dashboard");
  }

  const tenantId = session.tenantId;

  const [
    analytics,
    recentActivity,
    users,
    activityLogs,
    courierProviders,
    systemStats,
    systemSettings,
    businessSettings,
    rolePermissions,
    deletedProducts,
    deletedSales,
    deletedCustomers,
  ] = await Promise.all([
    getAdminAnalytics(tenantId, 30),
    getRecentActivity(tenantId, 30),
    listTenantUsers(tenantId),
    listActivityLogs(tenantId, { limit: 200 }),
    listCourierProviders(tenantId),
    getSystemStats(tenantId),
    getCachedSystemSettings(tenantId),
    getCachedBusinessSettings(tenantId),
    getAllRolePermissions(tenantId),
    prisma.product.findMany({
      where: { tenantId, isDeleted: true },
      orderBy: { deletedAt: "desc" },
      take: 100,
    }),
    prisma.sale.findMany({
      where: { tenantId, isDeleted: true },
      orderBy: { deletedAt: "desc" },
      take: 100,
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        grandTotal: true,
        deletedAt: true,
      },
    }),
    prisma.customer.findMany({
      where: { tenantId, isDeleted: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <AdminTabs
        currentUserId={session.userId}
        analytics={analytics}
        recentActivity={recentActivity}
        users={users}
        activityLogs={activityLogs}
        courierProviders={courierProviders}
        systemStats={systemStats}
        systemSettings={systemSettings}
        businessSettings={businessSettings}
        rolePermissions={rolePermissions}
        deletedProducts={deletedProducts}
        deletedSales={deletedSales}
        deletedCustomers={deletedCustomers}
      />
    </div>
  );
}
