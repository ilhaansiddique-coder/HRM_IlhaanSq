import bcrypt from "bcryptjs";
import { prisma } from "../db";

// Profile read/write for the authenticated user. Mirrors the patterns in
// PROFILE_PAGES_GUIDE but adapted for our Prisma + NextAuth stack:
//
//   - "Profile fields"  (full_name, phone, image) live on the `User` row.
//   - "Email"           also lives on `User.email`. Updating it just
//                       writes; uniqueness is enforced by Postgres.
//   - "Role"            is per-tenant via `TenantMember.role`, plus the
//                       global `User.isSuperAdmin` flag. Read-only here —
//                       role changes go through the admin user-management
//                       flow.
//   - "Password change" verifies the current password with bcrypt then
//                       hashes + writes the new one. No re-sign-in is
//                       required by NextAuth.

export type ProfileSnapshot = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isSuperAdmin: boolean;
  // Role on the *current* tenant (the one the viewer is operating in).
  // Null if the target isn't a member of that tenant — e.g. when a super
  // admin is viewing a user who belongs to a different workspace.
  roleInCurrentTenant: string | null;
  createdAt: Date;
};

export async function getProfile(
  userId: string,
  currentTenantId: string | null
): Promise<ProfileSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: currentTenantId
        ? { where: { tenantId: currentTenantId, isActive: true }, take: 1 }
        : { where: { isActive: true, isDefault: true }, take: 1 },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    isSuperAdmin: user.isSuperAdmin,
    roleInCurrentTenant: user.memberships[0]?.role ?? null,
    createdAt: user.createdAt,
  };
}

export type ProfileUpdates = {
  fullName?: string;
  email?: string;
  phone?: string | null;
};

export async function updateProfile(
  userId: string,
  updates: ProfileUpdates
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data: Record<string, unknown> = {};

  if (typeof updates.fullName === "string") {
    const trimmed = updates.fullName.trim();
    if (!trimmed) return { ok: false, error: "Full name is required." };
    data.fullName = trimmed;
  }

  if (typeof updates.email === "string") {
    const email = updates.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    data.email = email;
  }

  if (updates.phone !== undefined) {
    const phone = (updates.phone ?? "").trim() || null;
    if (phone && !/^[\d\s\-+()]{8,}$/.test(phone.replace(/\s/g, ""))) {
      return { ok: false, error: "Please enter a valid phone number." };
    }
    data.phone = phone;
  }

  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await prisma.user.update({ where: { id: userId }, data });
    return { ok: true };
  } catch (e: unknown) {
    // Most likely the unique constraint on email
    const msg = (e as { code?: string }).code === "P2002"
      ? "That email address is already taken."
      : "Failed to update profile. Please try again.";
    return { ok: false, error: msg };
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Please fill in all fields." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long." };
  }
  if (currentPassword === newPassword) {
    return { ok: false, error: "New password must be different from current." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustResetPassword: false },
  });
  return { ok: true };
}

// Admins (owner / admin / super admin) can view another user. Returns the
// caller's permission to view the target.
export async function canViewOtherUser(
  viewerSession: {
    userId: string;
    tenantId: string | null;
    role: string | null;
    isSuperAdmin: boolean;
  },
  targetUserId: string
): Promise<boolean> {
  if (viewerSession.userId === targetUserId) return true;
  if (viewerSession.isSuperAdmin) return true;

  const isTenantAdmin =
    viewerSession.role === "owner" || viewerSession.role === "admin";
  if (!isTenantAdmin || !viewerSession.tenantId) return false;

  // Tenant admins can only view users who are members of their own tenant.
  const sharedMembership = await prisma.tenantMember.findFirst({
    where: {
      tenantId: viewerSession.tenantId,
      userId: targetUserId,
      isActive: true,
    },
    select: { id: true },
  });
  return !!sharedMembership;
}
