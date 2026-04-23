"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function resetPasswordWithTokenAction(formData: FormData) {
  const token = formData.get("token") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!token || !newPassword) throw new Error("Token and password are required");
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) throw new Error("Invalid or expired link");
  if (record.type !== "password_reset") throw new Error("Invalid link");
  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    throw new Error("This link has expired. Request a new one.");
  }

  const user = await prisma.user.findUnique({ where: { email: record.email } });
  if (!user) throw new Error("Account not found");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustResetPassword: false, // also clears any forced-reset flag
    },
  });

  // Burn the token
  await prisma.verificationToken.delete({ where: { token } });
}
