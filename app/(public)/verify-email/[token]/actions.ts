"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function verifyEmailAndSetPasswordAction(formData: FormData) {
  const token = formData.get("token") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!token || !newPassword) throw new Error("Token and password are required");
  if (newPassword.length < 8)
    throw new Error("Password must be at least 8 characters");

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.type !== "email_verify")
    throw new Error("Invalid or expired link");
  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    throw new Error("This link has expired. Ask an admin to re-send it.");
  }

  const user = await prisma.user.findUnique({ where: { email: record.email } });
  if (!user) throw new Error("Account not found");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      emailVerified: true,
      mustResetPassword: false,
    },
  });

  // Email verified → the employee becomes ACTIVE (was suspended after the
  // admin approved onboarding).
  await prisma.employee.updateMany({
    where: { userId: user.id, approvalStatus: "approved" },
    data: { status: "active" },
  });

  await prisma.verificationToken.delete({ where: { token } });
}
