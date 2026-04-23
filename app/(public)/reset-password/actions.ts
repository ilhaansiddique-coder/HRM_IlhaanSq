"use server";

import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { randomBytes } from "crypto";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function requestPasswordResetAction(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  if (!email) throw new Error("Email is required");

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid email enumeration. Only send if user exists.
  if (!user) return;

  // Invalidate any existing reset tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { email, type: "password_reset" },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.verificationToken.create({
    data: { email, token, type: "password_reset", expiresAt },
  });

  const resetUrl = `${APP_URL}/reset-password/${token}`;

  await sendPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    resetUrl,
  });
}
