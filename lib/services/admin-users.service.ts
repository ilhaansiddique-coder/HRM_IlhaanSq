import { prisma } from "../db";
import bcrypt from "bcryptjs";

// ─── Admin User CRUD (creating users + setting passwords directly) ───

export type CreateUserInput = {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
  role: "owner" | "admin" | "manager" | "staff" | "member";
};

export async function listTenantUsers(tenantId: string) {
  return prisma.tenantMember.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          createdAt: true,
          lastSignInAt: true,
          emailVerified: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function adminCreateUser(tenantId: string, input: CreateUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      memberships: { select: { tenantId: true } },
    },
  });

  let userId: string;

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        emailVerified: true,
      },
      select: { id: true },
    });
    userId = created.id;
  } else {
    const alreadyMember = existing.memberships.some(
      (m) => m.tenantId === tenantId
    );
    if (!alreadyMember) {
      throw new Error(
        "A user with this email already exists in another workspace. Use the invite flow instead of creating the user here."
      );
    }
    // Same-tenant admin updating their own member's profile/password
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
      },
    });
    userId = existing.id;
  }

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: { role: input.role, isActive: true },
    create: {
      tenantId,
      userId,
      role: input.role,
      isActive: true,
      isDefault: false,
    },
  });

  return { id: userId, email };
}

export async function adminUpdateUser(
  tenantId: string,
  userId: string,
  input: Partial<{ fullName: string; phone: string; password: string }>
) {
  const membership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true },
  });
  if (!membership) throw new Error("User is not a member of this workspace");

  const data: Record<string, unknown> = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.user.update({ where: { id: userId }, data });
  return { id: userId };
}

export async function adminDeleteUser(tenantId: string, userId: string) {
  // Just remove tenant membership, don't delete user (they might be in other tenants)
  return prisma.tenantMember.delete({
    where: { tenantId_userId: { tenantId, userId } },
  });
}

// ─── Activity Logs (filtered) ───────────────────────────────

export async function listActivityLogs(
  tenantId: string,
  filters: { entityType?: string; action?: string; limit?: number } = {}
) {
  return prisma.activityLog.findMany({
    where: {
      tenantId,
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.action && { action: filters.action }),
    },
    include: {
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 500,
  });
}

// ─── Permissions Matrix ─────────────────────────────────────
// Permission catalog lives in lib/permissions.ts (no server deps,
// safe to import from client components).

import type { RoleKey } from "../permissions";
export { PERMISSION_CATEGORIES, ROLES } from "../permissions";
export type { RoleKey } from "../permissions";

export async function getRolePermissions(tenantId: string, role: RoleKey) {
  const perms = await prisma.tenantRolePermission.findMany({
    where: { tenantId, role: role as any },
  });
  return new Map(perms.map((p) => [p.permissionKey, p.allowed]));
}

/**
 * Fetch saved permissions for ALL roles in a single query.
 * Returns: { [role]: { [permissionKey]: boolean } }
 * Missing entries default to false (permission not granted).
 */
export async function getAllRolePermissions(
  tenantId: string
): Promise<Record<string, Record<string, boolean>>> {
  const perms = await prisma.tenantRolePermission.findMany({
    where: { tenantId },
  });

  const map: Record<string, Record<string, boolean>> = {};
  for (const p of perms) {
    if (!map[p.role]) map[p.role] = {};
    map[p.role][p.permissionKey] = p.allowed;
  }
  return map;
}

export async function setRolePermission(
  tenantId: string,
  role: RoleKey,
  permissionKey: string,
  allowed: boolean
) {
  return prisma.tenantRolePermission.upsert({
    where: {
      tenantId_role_permissionKey: { tenantId, role: role as any, permissionKey },
    },
    update: { allowed },
    create: { tenantId, role: role as any, permissionKey, allowed },
  });
}
