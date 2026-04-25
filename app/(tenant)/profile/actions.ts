"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  changePassword,
  updateProfile,
  type ProfileUpdates,
} from "@/lib/services/profile.service";

export async function updateProfileAction(
  updates: ProfileUpdates
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  const result = await updateProfile(session.userId, updates);
  if (result.ok) {
    revalidatePath("/profile");
  }
  return result;
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  return changePassword(session.userId, currentPassword, newPassword);
}
