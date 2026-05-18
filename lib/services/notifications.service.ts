import { prisma } from "../db";

// Recent notifications shown in the TopBar bell dropdown.
// Sourced from the persisted `Notification` table, which a global Prisma
// middleware (lib/activity-notify.ts) now populates for EVERY meaningful
// write across the whole app — plus the explicit approval notifications.
//
// Visibility:
//   - Super admin (tenantId = null): every notification across every tenant;
//     each row is labelled with its source tenant's name.
//   - Tenant user (tenantId = uuid): only that tenant's notifications.
//
// `excludeUserId` is kept in the signature for callers but no longer filters
// — activity notifications are not attributed to a user at the DB layer, and
// the user explicitly wants to see all activity (including their own).

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
  _excludeUserId: string,
  limit = 12
): Promise<NotificationItem[]> {
  // The bell is a non-critical convenience feature rendered in the shared
  // TenantLayout. A transient DB blip (e.g. a Neon compute cold start after
  // autosuspend) must not reject and 500 every page under (tenant) — degrade
  // to an empty list and log instead.
  try {
    const rows = await prisma.notification.findMany({
      where: tenantId ? { tenantId } : {},
      include: {
        // Label with the source tenant only for super admin (cross-tenant).
        tenant: tenantId ? false : { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      // The bell renders `action` (humanised) + optional ` · entityType`.
      // Our title is already human ("Leave request created"), so use it as
      // the action and suppress the entityType suffix.
      action: r.title,
      entityType: "",
      entityId: r.entityId,
      actorName: r.actorName,
      tenantName:
        "tenant" in r && r.tenant && typeof r.tenant === "object"
          ? (r.tenant as { name: string }).name
          : null,
      createdAt: r.createdAt,
      details: r.body ? { body: r.body } : null,
    }));
  } catch (err) {
    console.error("[notifications] failed to load recent notifications:", err);
    return [];
  }
}
