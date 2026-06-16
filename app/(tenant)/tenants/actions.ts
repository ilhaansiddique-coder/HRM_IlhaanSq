"use server";

import { requireSuperAdmin } from "@/lib/auth";
import {
  toggleTenantActive,
  createTenantWithAdmin,
  hardDeleteTenant,
  updateTenant,
} from "@/lib/services/tenant.service";
import {
  approveDemoRequest,
  rejectDemoRequest,
  resetDemoRequest,
} from "@/lib/services/demo-request.service";
import { revalidatePath } from "next/cache";

export async function toggleTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = formData.get("tenantId") as string;
  const isActive = formData.get("isActive") === "true";
  await toggleTenantActive(tenantId, isActive);
  revalidatePath("/tenants");
  revalidatePath("/hr");
}

export async function deleteTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = formData.get("tenantId") as string;
  if (!tenantId) throw new Error("tenantId is required");
  await hardDeleteTenant(tenantId);
  revalidatePath("/tenants");
  revalidatePath("/hr");
}

export async function approveRequestAction(
  requestId: string,
  customPassword?: string
) {
  const session = await requireSuperAdmin();
  const result = await approveDemoRequest(requestId, session.userId, {
    customPassword,
  });
  revalidatePath("/hr");
  revalidatePath("/tenants");
  revalidatePath("/tenants/requests");
  revalidatePath("/tenants/approved");
  return {
    email: result.user.email,
    password: result.tempPassword,
    tenantName: result.tenant.name,
    emailDelivered: result.emailDelivered,
    emailError: result.emailError,
  };
}

export async function resetRequestAction(requestId: string) {
  await requireSuperAdmin();
  await resetDemoRequest(requestId);
  revalidatePath("/hr");
  revalidatePath("/tenants");
  revalidatePath("/tenants/requests");
  revalidatePath("/tenants/approved");
  revalidatePath("/tenants/declined");
}

export async function rejectRequestAction(requestId: string, reason?: string) {
  const session = await requireSuperAdmin();
  await rejectDemoRequest(requestId, session.userId, reason);
  revalidatePath("/hr");
  revalidatePath("/tenants/requests");
  revalidatePath("/tenants/declined");
}

export async function updateTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = formData.get("tenantId") as string;
  const name = formData.get("name") as string | null;
  const slug = formData.get("slug") as string | null;
  const plan = formData.get("plan") as string | null;
  await updateTenant(tenantId, {
    ...(name ? { name } : {}),
    ...(slug ? { slug } : {}),
    ...(plan ? { plan } : {}),
  });
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${tenantId}`);
}

export async function createTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const result = await createTenantWithAdmin({
    businessName: formData.get("businessName") as string,
    ownerName: formData.get("ownerName") as string,
    ownerEmail: formData.get("ownerEmail") as string,
    ownerPhone: (formData.get("ownerPhone") as string) || undefined,
    ownerPassword: formData.get("ownerPassword") as string,
    plan: (formData.get("plan") as string) || "starter",
    slug: (formData.get("slug") as string) || undefined,
  });
  revalidatePath("/hr");
  revalidatePath("/tenants");
  return {
    email: result.user.email,
    tenantName: result.tenant.name,
    tenantSlug: result.tenant.slug,
    emailDelivered: result.emailDelivered,
    emailError: result.emailError,
  };
}
