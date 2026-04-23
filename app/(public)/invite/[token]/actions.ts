"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function acceptInviteAction(formData: FormData) {
  const token = formData.get("token") as string;
  const fullName = formData.get("fullName") as string;
  const password = formData.get("password") as string;

  if (!token || !fullName || !password) {
    throw new Error("All fields are required");
  }

  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: { tenant: true },
  });
  if (!invite) throw new Error("Invalid invite");
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");

  const email = invite.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  // Create or update user
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, fullName, emailVerified: true },
    });
  } else {
    user = await prisma.user.create({
      data: { email, passwordHash, fullName, emailVerified: true },
    });
  }

  // Add to tenant
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: invite.tenantId, userId: user.id } },
    update: { role: invite.role, isActive: true, isDefault: true },
    create: {
      tenantId: invite.tenantId,
      userId: user.id,
      role: invite.role,
      isActive: true,
      isDefault: true,
    },
  });

  // Delete the invite (consumed)
  await prisma.tenantInvite.delete({ where: { token } });

  return { success: true };
}
