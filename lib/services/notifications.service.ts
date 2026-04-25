import { prisma } from "../db";

// Recent notifications shown in the TopBar bell dropdown.
// Sourced from the existing `ActivityLog` table — every tenant write path
// already records there, so we get notifications "for free" without a new
// schema. Super admins see platform-wide activity (no tenant filter).

export type NotificationItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: Date;
  details: Record<string, unknown> | null;
};

export async function getRecentNotifications(
  tenantId: string | null,
  limit = 12
): Promise<NotificationItem[]> {
  const rows = await prisma.activityLog.findMany({
    where: tenantId ? { tenantId } : {},
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorName: r.user?.fullName ?? null,
    createdAt: r.createdAt,
    details: (r.details as Record<string, unknown> | null) ?? null,
  }));
}
