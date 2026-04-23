import { prisma } from "../db";
import { createTenant } from "./tenant.service";
import { sendApprovalEmail } from "../email";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// ─── Submit a new demo / access request ─────────────────────

export type CreateDemoRequestInput = {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  businessType: string;
  requestedSlug?: string;
  requestedPlan?: string;
  message?: string;
};

export async function createDemoRequest(input: CreateDemoRequestInput) {
  const email = input.email.toLowerCase().trim();

  // Reject if user already has an active account
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("An account with this email already exists. Please sign in instead.");
  }

  // Reject if there's already a pending request for this email
  const existingPending = await prisma.demoRequest.findFirst({
    where: { email, status: "pending" },
  });
  if (existingPending) {
    throw new Error("A request with this email is already pending review.");
  }

  return prisma.demoRequest.create({
    data: {
      fullName: input.fullName.trim(),
      businessName: input.businessName.trim(),
      email,
      phone: input.phone.trim(),
      businessType: input.businessType,
      requestedSlug: input.requestedSlug?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || null,
      requestedPlan: input.requestedPlan ?? "starter",
      message: input.message?.trim() || null,
      status: "pending",
    },
  });
}

// ─── List requests (super admin) ────────────────────────────

export async function listDemoRequests(status?: "pending" | "approved" | "rejected") {
  return prisma.demoRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Approve a request: create user + tenant + send temp password ───

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = randomBytes(12);
  return Array.from(buf)
    .map((b) => chars[b % chars.length])
    .join("");
}

export async function approveDemoRequest(
  requestId: string,
  reviewerId: string,
  options?: { customPassword?: string }
) {
  const request = await prisma.demoRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Request not found");
  if (request.status === "approved")
    throw new Error("Already approved. Reset the request first to issue new credentials.");
  if (request.status === "rejected")
    throw new Error("This request was declined. Reset it first to approve.");

  // Use the custom password if provided, otherwise auto-generate.
  const customPassword = options?.customPassword?.trim();
  if (customPassword && customPassword.length < 8) {
    throw new Error("Custom password must be at least 8 characters");
  }
  const tempPassword = customPassword || generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Create user with mustResetPassword flag = true (forces reset on first login)
  let user = await prisma.user.findUnique({ where: { email: request.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: request.email,
        passwordHash,
        fullName: request.fullName,
        phone: request.phone,
        emailVerified: true,
        mustResetPassword: true,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        fullName: request.fullName,
        phone: request.phone,
        mustResetPassword: true,
      },
    });
  }

  // Reuse existing tenant on re-approval, otherwise create a new one
  let tenant;
  if (request.tenantId) {
    const existing = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
    });
    tenant = existing ?? (await createTenant(user.id, {
      name: request.businessName,
      slug: request.requestedSlug ?? undefined,
    }));
  } else {
    tenant = await createTenant(user.id, {
      name: request.businessName,
      slug: request.requestedSlug ?? undefined,
    });
  }

  // Update request
  await prisma.demoRequest.update({
    where: { id: requestId },
    data: {
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      tenantId: tenant.id,
      approvedUserId: user.id,
      tempPassword, // Stored briefly so it can be re-fetched/resent
    },
  });

  // Send welcome email (non-blocking — log failure but don't break approval)
  const emailResult = await sendApprovalEmail({
    to: user.email,
    fullName: user.fullName,
    businessName: tenant.name,
    tempPassword,
  });

  return { user, tenant, tempPassword, emailDelivered: emailResult.delivered, emailError: emailResult.reason };
}

export async function rejectDemoRequest(
  requestId: string,
  reviewerId: string,
  reason?: string
) {
  const request = await prisma.demoRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error("Already reviewed");

  return prisma.demoRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: reason ?? null,
    },
  });
}

// ─── Reset a request back to pending (for re-review) ────────
// Used when admin wants to undo an approve/decline.
// - Clears reviewedBy, reviewedAt, tempPassword, rejectionReason
// - Keeps tenantId/approvedUserId so re-approval can REUSE the tenant
//   (no orphaned tenants created on re-approval)

export async function resetDemoRequest(requestId: string) {
  const request = await prisma.demoRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Request not found");
  if (request.status === "pending") return request;

  return prisma.demoRequest.update({
    where: { id: requestId },
    data: {
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      tempPassword: null,
      rejectionReason: null,
    },
  });
}
