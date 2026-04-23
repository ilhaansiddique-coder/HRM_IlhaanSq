"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function changePasswordAction(formData: FormData) {
  const session = await requireAuth();
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!currentPassword || !newPassword) {
    throw new Error("Both passwords are required");
  }
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) throw new Error("User not found");

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");

  // Reject if new password is identical to old
  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) throw new Error("New password must be different from the temporary password");

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustResetPassword: false,
    },
  });

  // Clean up the stored temp password on the demo request (no longer needed)
  await prisma.demoRequest.updateMany({
    where: { approvedUserId: user.id, tempPassword: { not: null } },
    data: { tempPassword: null },
  });
}
