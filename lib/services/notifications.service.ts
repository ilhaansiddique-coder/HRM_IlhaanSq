import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

// Recent notifications shown in the TopBar bell dropdown.
// Sourced from the existing `ActivityLog` table — every tenant write path
// already records there, so we get notifications "for free" without a new
// schema.
//
// Visibility rules:
//   - Super admin (tenantId = null): every activity across every tenant,
//     by every user. The viewer's own actions are filtered out (you don't
//     need to be notified of what you just did).
//   - Tenant user (tenantId = uuid): only activities by OTHER users
//     within the same tenant — own actions excluded, other tenants'
//     activity excluded.
//
// For super admin output we also include the source tenant's name so the
// bell can label each row with which workspace it came from. Tenant-scope
// output omits it (every row would just be the viewer's own tenant).

export type NotificationItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  tenantName: string | null;
  createdAt: Date;
  details: Record<string, unknown> | null;
};

export async function getRecentNotifications(
  tenantId: string | null,
  excludeUserId: string,
  limit = 12
): Promise<NotificationItem[]> {
  const where: Prisma.ActivityLogWhereInput = {
    NOT: { userId: excludeUserId },
  };
  if (tenantId) where.tenantId = tenantId;

  const rows = await prisma.activityLog.findMany({
    where,
    include: {
      user: { select: { fullName: true } },
      // Include the tenant name only for super admin (cross-tenant) — for
      // tenant-scoped views every row is the viewer's own tenant so the
      // label adds no information.
      tenant: tenantId ? false : { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorName: r.user?.fullName ?? null,
    tenantName:
      "tenant" in r && r.tenant && typeof r.tenant === "object"
        ? (r.tenant as { name: string }).name
        : null,
    createdAt: r.createdAt,
    details: (r.details as Record<string, unknown> | null) ?? null,
  }));
}
