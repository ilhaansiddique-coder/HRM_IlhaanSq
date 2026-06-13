import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { sendEmployeeOnboardingEmail } from "../email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Called when an employee_onboarding approval is APPROVED. Provisions a login
// account for the employee (role = "employee"), links it to the Employee
// record, and emails a verify-email + set-password link. The employee stays
// suspended until they verify (login gate = emailVerified).
export async function provisionEmployeeAccount(
  tenantId: string,
  employeeId: string
): Promise<void> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    include: { tenant: { select: { name: true } } },
  });
  if (!employee) return;

  const email = employee.email.toLowerCase().trim();

  // Reuse an existing account for this email if there is one; otherwise create
  // a placeholder account (random password, unverified) the employee will
  // claim via the verification link.
  let user = await prisma.user.findUnique({ where: { email } });
  let needsVerification = false;

  if (!user) {
    const placeholder = randomBytes(24).toString("hex");
    const bcrypt = (await import("bcryptjs")).default;
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(placeholder, 12),
        fullName: employee.fullName,
        phone: employee.phone ?? null,
        emailVerified: false,
        mustResetPassword: false,
      },
    });
    needsVerification = true;
  } else if (!user.emailVerified) {
    needsVerification = true;
  }

  // Ensure a tenant membership with the employee role (don't downgrade an
  // existing higher-privilege membership — keep whatever's there).
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, role: "employee", isActive: true },
    update: {},
  });

  // Link the Employee record to the login account.
  if (employee.userId !== user.id) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    });
  }

  if (!needsVerification) return;

  await prisma.verificationToken.deleteMany({
    where: { email, type: "email_verify" },
  });
  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      email,
      token,
      type: "email_verify",
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });

  await sendEmployeeOnboardingEmail({
    to: email,
    fullName: employee.fullName,
    businessName: employee.tenant?.name ?? "your workspace",
    verifyUrl: `${APP_URL}/verify-email/${token}`,
  });
}

// Admin-driven, email-INDEPENDENT onboarding. Provisions the login account,
// links it, and immediately marks the employee ACTIVE + email-verified so they
// flow into payroll / attendance / dropdowns right away — no email round-trip.
// For a freshly created account it returns a one-time temporary password the
// admin must hand to the employee (mustResetPassword forces a change on first
// login). If an account already exists for the email, it's reused (no temp
// password) and just verified + linked.
export async function activateEmployeeWithoutEmail(
  tenantId: string,
  employeeId: string,
  decider?: { userId: string; name: string }
): Promise<{ email: string; tempPassword: string | null; reused: boolean }> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
  });
  if (!employee) throw new Error("Employee not found");

  const email = employee.email.toLowerCase().trim();
  const bcrypt = (await import("bcryptjs")).default;

  let user = await prisma.user.findUnique({ where: { email } });
  let tempPassword: string | null = null;
  let reused = false;

  if (!user) {
    // Readable one-time password the admin can pass on; forced reset on login.
    tempPassword = randomBytes(9).toString("base64url");
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(tempPassword, 12),
        fullName: employee.fullName,
        phone: employee.phone ?? null,
        emailVerified: true,
        mustResetPassword: true,
      },
    });
  } else {
    reused = true;
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }
  }

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, role: "employee", isActive: true },
    update: { isActive: true },
  });

  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      userId: user.id,
      status: "active",
      approvalStatus: "approved",
      approvalRejectionReason: null,
      ...(decider
        ? { approvalDecidedBy: decider.userId, approvalDecidedAt: new Date() }
        : {}),
    },
  });

  // No pending verification needed any more.
  await prisma.verificationToken.deleteMany({
    where: { email, type: "email_verify" },
  });

  return { email, tempPassword, reused };
}
