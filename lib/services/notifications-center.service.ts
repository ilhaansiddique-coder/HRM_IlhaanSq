import { prisma } from "../db";
import { publishRealtime } from "../realtime/bus";

// Admin notification center. Distinct from the lightweight TopBar bell
// (lib/services/notifications.service.ts, activity-log only). This is a
// persisted, per-user read/unread feed shown in /admin → Notifications.
//
// The admin feed reads the persisted `Notification` table, which a global
// Prisma middleware (lib/activity-notify.ts) populates for EVERY meaningful
// write across the app, plus the explicit approval notifications.
// Read/unread is tracked per user via NotificationRead. (The separate
// `ActivityLog` table still powers the Activity Logs tab and analytics.)

export async function createNotification(input: {
  tenantId: string;
  category?: string; // "activity" | "approval" | "system"
  type: string; // e.g. "approval.employee_onboarding.requested"
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  severity?: string; // info | success | warning | critical
}) {
  try {
    await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        category: input.category ?? "activity",
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        severity: input.severity ?? "info",
      },
    });
    // Push it to every open page for this tenant (instant toast + refresh).
    publishRealtime({
      tenantId: input.tenantId,
      kind: "notification",
      category: input.category ?? "activity",
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? "info",
    });
  } catch (e) {
    // Notifications must never break the originating flow.
    console.error("[notifications-center] create failed:", e);
  }
}

export type AdminNotification = {
  id: string;
  source: "notification" | "activity";
  category: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  link: string | null;
  actorName: string | null;
  severity: string;
  createdAt: string;
  read: boolean;
};

export async function listAdminNotifications(
  tenantId: string,
  userId: string,
  opts: { limit?: number } = {}
): Promise<AdminNotification[]> {
  const limit = opts.limit ?? 120;

  const [notifs, reads] = await Promise.all([
    prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notificationRead.findMany({
      where: { userId, notification: { tenantId } },
      select: { notificationId: true },
    }),
  ]);

  const readSet = new Set(reads.map((r) => r.notificationId));

  return notifs.map((n) => ({
    id: n.id,
    source: "notification" as const,
    category: n.category,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entityType,
    link: n.link,
    actorName: n.actorName,
    severity: n.severity,
    createdAt: n.createdAt.toISOString(),
    read: readSet.has(n.id),
  }));
}

export async function getUnreadNotificationCount(
  tenantId: string,
  userId: string
): Promise<number> {
  const unread = await prisma.notification.count({
    where: { tenantId, reads: { none: { userId } } },
  });
  return unread;
}

export async function markNotificationRead(
  tenantId: string,
  userId: string,
  notificationId: string
) {
  const n = await prisma.notification.findFirst({
    where: { id: notificationId, tenantId },
    select: { id: true },
  });
  if (!n) return;
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId },
    update: {},
  });
}

export async function markAllNotificationsRead(
  tenantId: string,
  userId: string
) {
  const unread = await prisma.notification.findMany({
    where: { tenantId, reads: { none: { userId } } },
    select: { id: true },
  });
  if (unread.length === 0) return;
  await prisma.notificationRead.createMany({
    data: unread.map((n) => ({ notificationId: n.id, userId })),
    skipDuplicates: true,
  });
}
