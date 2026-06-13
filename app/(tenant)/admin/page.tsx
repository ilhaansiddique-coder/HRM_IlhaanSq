import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import {
  listTenantUsers,
  listActivityLogs,
  getAllRolePermissions,
} from "@/lib/services/admin-users.service";
import { getSystemStats } from "@/lib/services/backup.service";
import {
  getCachedSystemSettings,
  getCachedBusinessSettings,
} from "@/lib/cache";
import {
  listApprovalRequests,
  getApprovalStats,
} from "@/lib/services/approvals.service";
import {
  listAdminNotifications,
  getUnreadNotificationCount,
} from "@/lib/services/notifications-center.service";
import { AdminTabs } from "./_components/admin-tabs";

export default async function AdminPage() {
  const session = await requireTenant();
  if (!["owner", "admin", "superadmin"].includes(session.role ?? "")) {
    redirect("/dashboard");
  }

  const tenantId = session.tenantId;

  const [
    users,
    activityLogs,
    systemStats,
    systemSettings,
    businessSettings,
    rolePermissions,
    approvals,
    approvalStats,
    notifications,
    unreadNotifications,
  ] = await Promise.all([
    listTenantUsers(tenantId),
    listActivityLogs(tenantId, { limit: 200 }),
    getSystemStats(tenantId),
    getCachedSystemSettings(tenantId),
    getCachedBusinessSettings(tenantId),
    getAllRolePermissions(tenantId),
    listApprovalRequests(tenantId),
    getApprovalStats(tenantId),
    listAdminNotifications(tenantId, session.userId),
    getUnreadNotificationCount(tenantId, session.userId),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <AdminTabs
        currentUserId={session.userId}
        users={users}
        activityLogs={activityLogs}
        systemStats={systemStats}
        systemSettings={systemSettings}
        businessSettings={businessSettings}
        rolePermissions={rolePermissions}
        approvals={approvals}
        approvalStats={approvalStats}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
      />
    </div>
  );
}
