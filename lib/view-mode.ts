// View-mode ("Continue as …") support. A user can hold several roles at once —
// e.g. a super-admin who is also an owner of one tenant and a linked employee
// in another. This module computes which views a user may enter and resolves
// the active view from a per-user cookie, so a single override in getSession()
// makes the whole app (sidebar, page guards, isAdmin checks) behave per-view.
//
// SERVER-ONLY (imports prisma + next/headers). Never import into a client or
// edge module.

import { cookies } from "next/headers";
import { prisma } from "./db";

export type ViewMode = "superadmin" | "owner" | "admin" | "employee";

export const VIEW_LABELS: Record<ViewMode, string> = {
  superadmin: "Super Admin",
  owner: "Owner",
  admin: "Admin",
  employee: "Employee",
};

export const VIEW_DESCRIPTIONS: Record<ViewMode, string> = {
  superadmin: "Manage every workspace across the platform.",
  owner: "Run this workspace — HR, payroll, settings.",
  admin: "Manage this workspace's HR and operations.",
  employee: "Your own attendance, breaks and payslips.",
};

export function viewLanding(mode: ViewMode): string {
  switch (mode) {
    case "superadmin":
      return "/tenants";
    case "owner":
    case "admin":
      return "/hr";
    case "employee":
      return "/employee";
  }
}

export function viewCookieName(userId: string): string {
  return `view:${userId}`;
}

type BaseSession = {
  userId: string;
  tenantId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
};

/**
 * Which views this user may enter in their current tenant. Order = preference
 * (most privileged first). Two indexed lookups; only the views actually backed
 * by a membership / employee record / super-admin flag are returned.
 */
export async function getAvailableViews(base: BaseSession): Promise<ViewMode[]> {
  // Read isSuperAdmin from the DB (not base.isSuperAdmin): when the user is
  // *in* a non-super view, the session flag is overridden to false, but the
  // switcher must still offer Super Admin so they can switch back.
  const [user, member, employee] = await Promise.all([
    prisma.user.findUnique({
      where: { id: base.userId },
      select: { isSuperAdmin: true },
    }),
    base.tenantId
      ? prisma.tenantMember.findUnique({
          where: { tenantId_userId: { tenantId: base.tenantId, userId: base.userId } },
          select: { role: true },
        })
      : null,
    base.tenantId
      ? prisma.employee.findFirst({
          where: { tenantId: base.tenantId, userId: base.userId },
          select: { id: true },
        })
      : null,
  ]);

  const modes: ViewMode[] = [];
  if (user?.isSuperAdmin) modes.push("superadmin");
  if (member?.role === "owner") modes.push("owner");
  else if (member?.role === "admin") modes.push("admin");
  if (employee) modes.push("employee");

  return modes;
}

/**
 * Resolve the active view from the per-user cookie, validated against what the
 * user actually holds (a cookie can be hand-set in devtools, so never trust it
 * without a server-side check). Returns the effective role/isSuperAdmin to
 * apply, or null when there's no valid override (fall back to the token role).
 * Cheap: at most one extra query, and none for the super-admin view.
 */
export async function resolveViewOverride(
  base: BaseSession
): Promise<{ role: string; isSuperAdmin: boolean; activeView: ViewMode } | null> {
  if (!base.tenantId) return null;

  let raw: string | undefined;
  try {
    raw = (await cookies()).get(viewCookieName(base.userId))?.value;
  } catch {
    // Outside a request scope (e.g. a Node script) — no override.
    return null;
  }
  if (!raw) return null;

  if (raw === "superadmin") {
    if (!base.isSuperAdmin) return null;
    return { role: "superadmin", isSuperAdmin: true, activeView: "superadmin" };
  }

  if (raw === "employee") {
    const emp = await prisma.employee.findFirst({
      where: { tenantId: base.tenantId, userId: base.userId },
      select: { id: true },
    });
    if (!emp) return null;
    return { role: "employee", isSuperAdmin: false, activeView: "employee" };
  }

  if (raw === "owner" || raw === "admin") {
    const member = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: base.tenantId, userId: base.userId } },
      select: { role: true },
    });
    if (member?.role !== raw) return null;
    return { role: raw, isSuperAdmin: false, activeView: raw };
  }

  return null;
}
