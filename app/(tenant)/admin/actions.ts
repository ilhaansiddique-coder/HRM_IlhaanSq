"use server";

import { requireTenant } from "@/lib/auth";
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUser,
  setRolePermission,
  upsertCourierProvider,
  permanentDeleteProduct,
  permanentDeleteSale,
  permanentDeleteCustomer,
} from "@/lib/services/admin-users.service";
import {
  updateBusinessSettings,
  updateSystemSettings,
} from "@/lib/services/settings.service";
import { exportTenantData } from "@/lib/services/backup.service";
import {
  invalidateProductCache,
  invalidateSaleCache,
  invalidateCustomerCache,
  invalidateSettingsCache,
} from "@/lib/cache";
import { revalidatePath } from "next/cache";

function ensureAdmin(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Forbidden");
  }
}

// ─── User Management ────────────────────────────────────────

export async function createUserAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);

  await adminCreateUser(session.tenantId, {
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
    password: formData.get("password") as string,
    phone: (formData.get("phone") as string) || undefined,
    role: (formData.get("role") as any) ?? "staff",
  });
  revalidatePath("/admin");
}

export async function updateUserAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);

  await adminUpdateUser(session.tenantId, formData.get("userId") as string, {
    fullName: (formData.get("fullName") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    password: (formData.get("password") as string) || undefined,
  });
  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const userId = formData.get("userId") as string;
  if (userId === session.userId) throw new Error("Cannot remove yourself");
  await adminDeleteUser(session.tenantId, userId);
  revalidatePath("/admin");
}

// ─── Permission Toggle ──────────────────────────────────────

export async function togglePermissionAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);

  await setRolePermission(
    session.tenantId,
    formData.get("role") as any,
    formData.get("permissionKey") as string,
    formData.get("allowed") === "true"
  );
  revalidatePath("/admin");
}

// ─── System Settings ────────────────────────────────────────

export async function saveSystemSettingsAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);

  await updateSystemSettings(session.tenantId, {
    currencySymbol: formData.get("currencySymbol") as string,
    currencyCode: formData.get("currencyCode") as string,
    timezone: formData.get("timezone") as string,
    dateFormat: formData.get("dateFormat") as string,
    timeFormat: formData.get("timeFormat") as string,
  });
  revalidatePath("/admin");
}

// ─── Courier Provider ───────────────────────────────────────

export async function saveCourierProviderAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);

  await upsertCourierProvider(session.tenantId, {
    provider: formData.get("provider") as string,
    isEnabled: formData.get("isEnabled") === "true",
    apiKey: (formData.get("apiKey") as string) || undefined,
    secretKey: (formData.get("secretKey") as string) || undefined,
    autoRefresh: formData.get("autoRefresh") === "true",
    refreshInterval: (formData.get("refreshInterval") as string) || "hourly",
  });
  revalidatePath("/admin");
}

// ─── Trash (permanent delete) ───────────────────────────────

export async function permanentDeleteProductAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const id = formData.get("id") as string;
  await permanentDeleteProduct(session.tenantId, id);
  await invalidateProductCache(session.tenantId, id);
  revalidatePath("/admin");
}

export async function permanentDeleteSaleAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const id = formData.get("id") as string;
  await permanentDeleteSale(session.tenantId, id);
  await invalidateSaleCache(session.tenantId);
  revalidatePath("/admin");
}

export async function permanentDeleteCustomerAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const id = formData.get("id") as string;
  await permanentDeleteCustomer(session.tenantId, id);
  await invalidateCustomerCache(session.tenantId);
  revalidatePath("/admin");
}

// ─── Restore (move from trash) ──────────────────────────────

import { prisma } from "@/lib/db";

export async function restoreProductAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const id = formData.get("id") as string;

  const owned = await prisma.product.findFirst({
    where: { id, tenantId: session.tenantId, isDeleted: true },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");

  await prisma.product.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
  });
  await invalidateProductCache(session.tenantId, id);
  revalidatePath("/admin");
}

export async function restoreSaleAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const id = formData.get("id") as string;

  const owned = await prisma.sale.findFirst({
    where: { id, tenantId: session.tenantId, isDeleted: true },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");

  await prisma.sale.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
  });
  await invalidateSaleCache(session.tenantId);
  revalidatePath("/admin");
}

export async function restoreCustomerAction(formData: FormData) {
  const session = await requireTenant();
  ensureAdmin(session.role);
  const id = formData.get("id") as string;

  const owned = await prisma.customer.findFirst({
    where: { id, tenantId: session.tenantId, isDeleted: true },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");

  await prisma.customer.update({
    where: { id },
    data: { isDeleted: false },
  });
  await invalidateCustomerCache(session.tenantId);
  revalidatePath("/admin");
}

// ─── Backup ─────────────────────────────────────────────────

export async function exportBackupAction() {
  const session = await requireTenant();
  ensureAdmin(session.role);
  return exportTenantData(session.tenantId);
}
