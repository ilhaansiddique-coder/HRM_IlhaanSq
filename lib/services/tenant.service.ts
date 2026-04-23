import { prisma } from "../db";
import { randomBytes } from "crypto";
import { sendApprovalEmail } from "../email";

export async function createTenant(
  userId: string,
  input: { name: string; slug?: string }
) {
  const slug =
    input.slug ??
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);

  // Make slug unique
  let finalSlug = slug;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${slug}-${counter++}`;
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug: finalSlug,
      name: input.name,
      createdBy: userId,
      members: {
        create: {
          userId,
          role: "owner",
          isDefault: true,
          isActive: true,
        },
      },
      businessSettings: {
        create: { businessName: input.name },
      },
      systemSettings: {
        create: {
          currencySymbol: "৳",
          currencyCode: "BDT",
          timezone: "Asia/Dhaka",
        },
      },
      paymentMethods: {
        create: { name: "Cash", isActive: true },
      },
    },
  });

  return tenant;
}

export async function inviteMember(
  tenantId: string,
  email: string,
  role: "admin" | "manager" | "staff" | "member" = "staff"
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return prisma.tenantInvite.create({
    data: {
      tenantId,
      email: email.toLowerCase().trim(),
      role,
      token,
      expiresAt,
    },
  });
}

export async function listMembers(tenantId: string) {
  return prisma.tenantMember.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          lastSignInAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateMemberRole(
  tenantId: string,
  userId: string,
  role: "owner" | "admin" | "manager" | "staff" | "member"
) {
  return prisma.tenantMember.update({
    where: { tenantId_userId: { tenantId, userId } },
    data: { role },
  });
}

export async function removeMember(tenantId: string, userId: string) {
  return prisma.tenantMember.delete({
    where: { tenantId_userId: { tenantId, userId } },
  });
}

// ─── Super-admin direct tenant creation ─────────────────────
// Creates a User + Tenant + Owner membership in one go.
// Used when super admin wants to provision a tenant manually
// (vs. approving an existing demo request).

import bcrypt from "bcryptjs";

export type CreateTenantWithAdminInput = {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerPassword: string;
  plan?: string;
  slug?: string;
};

export async function createTenantWithAdmin(input: CreateTenantWithAdminInput) {
  const email = input.ownerEmail.toLowerCase().trim();

  // Reject if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: input.ownerName,
      phone: input.ownerPhone,
      emailVerified: true,
    },
  });

  const tenant = await createTenant(user.id, {
    name: input.businessName,
    slug: input.slug,
  });

  if (input.plan && input.plan !== "starter") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: input.plan },
    });
  }

  // Send welcome email with credentials. Non-blocking on delivery failure so
  // the super-admin always gets the success dialog (and can copy the password
  // manually if SMTP isn't configured).
  const emailResult = await sendApprovalEmail({
    to: user.email,
    fullName: user.fullName,
    businessName: tenant.name,
    tempPassword: input.ownerPassword,
  });

  return {
    user,
    tenant,
    emailDelivered: emailResult.delivered,
    emailError: emailResult.reason,
  };
}

export async function listAllTenants() {
  return prisma.tenant.findMany({
    include: {
      _count: {
        select: { members: true, products: true, sales: true, customers: true },
      },
      businessSettings: { select: { businessName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleTenantActive(tenantId: string, isActive: boolean) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive },
  });
}

// ─── Hard delete a tenant ────────────────────────────────────
// Irreversibly removes the tenant row. Schema uses onDelete: Cascade on
// every tenant relation, so child rows (products, sales, customers, HR, etc.)
// go with it. Also removes any owner users who no longer belong to any
// tenant so the `users` table doesn't accumulate orphans.

export async function getTenantDeletionPreview(tenantId: string) {
  const [tenant, counts] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        _count: {
          select: {
            members: true,
            products: true,
            sales: true,
            customers: true,
          },
        },
      },
    }),
  ]);
  if (!tenant) return null;
  return { ...tenant, counts: counts?._count ?? null };
}

export async function hardDeleteTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      members: { select: { userId: true } },
    },
  });
  if (!tenant) throw new Error("Tenant not found");

  const memberUserIds = tenant.members.map((m) => m.userId);

  await prisma.$transaction(async (tx) => {
    // Deleting the tenant cascades to all its children (see schema).
    await tx.tenant.delete({ where: { id: tenantId } });

    // Remove users who now belong to zero tenants AND aren't super-admins.
    if (memberUserIds.length) {
      const orphans = await tx.user.findMany({
        where: {
          id: { in: memberUserIds },
          isSuperAdmin: false,
          memberships: { none: {} },
        },
        select: { id: true },
      });
      if (orphans.length) {
        await tx.user.deleteMany({
          where: { id: { in: orphans.map((u) => u.id) } },
        });
      }
    }
  });

  return { id: tenantId, name: tenant.name, orphanedUsers: memberUserIds.length };
}
