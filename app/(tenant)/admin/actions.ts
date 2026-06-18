"use server";

import { requireTenant } from "@/lib/auth";
import { setRequestActor } from "@/lib/request-actor";
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUser,
  setRolePermission,
} from "@/lib/services/admin-users.service";
import { updateSystemSettings } from "@/lib/services/settings.service";
import { exportTenantData } from "@/lib/services/backup.service";
import {
  approveRequest,
  rejectRequest,
  requestChanges,
  getApprovalDetail,
  approveJobWithEdits,
  approveWithPayloadEdits,
  approveOnboardingDirect,
  type ApprovalDetail,
} from "@/lib/services/approvals.service";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/services/notifications-center.service";
import { revalidatePath } from "next/cache";

function ensureAdmin(role: string | null) {
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    throw new Error("Forbidden");
  }
}

// ─── User Management ────────────────────────────────────────

export async function createUserAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  const userId = formData.get("userId") as string;
  if (userId === session.userId) throw new Error("Cannot remove yourself");
  await adminDeleteUser(session.tenantId, userId);
  revalidatePath("/admin");
}

// ─── Permission Toggle ──────────────────────────────────────

export async function togglePermissionAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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

// ─── Backup ─────────────────────────────────────────────────

export async function exportBackupAction() {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  return exportTenantData(session.tenantId);
}

// ─── Approvals ──────────────────────────────────────────────

export async function approveRequestAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  await approveRequest(session.tenantId, formData.get("id") as string, {
    userId: session.userId,
    name: session.name,
  });
  revalidatePath("/admin");
  revalidatePath("/hr/employees");
  revalidatePath("/hr/recruitment/pipeline");
  revalidatePath("/hr/recruitment/jobs");
}

// Activate an employee_onboarding request immediately without the email
// verify round-trip. Returns the one-time temp password (new account) so the
// admin can hand it over. Called directly from the client (not a form action).
export async function activateEmployeeNowAction(id: string): Promise<{
  ok: boolean;
  email?: string;
  tempPassword?: string | null;
  reused?: boolean;
  error?: string;
}> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    ensureAdmin(session.role);
    const res = await approveOnboardingDirect(session.tenantId, id, {
      userId: session.userId,
      name: session.name,
    });
    revalidatePath("/admin");
    revalidatePath("/hr/employees");
    revalidatePath("/hr/payroll");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function approvalDetailAction(
  id: string
): Promise<ApprovalDetail | { error: string }> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    ensureAdmin(session.role);
    return await getApprovalDetail(session.tenantId, id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load details" };
  }
}

export async function approveWithEditsAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  await approveJobWithEdits(
    session.tenantId,
    formData.get("id") as string,
    { userId: session.userId, name: session.name },
    {
      title: (formData.get("title") as string)?.trim() ?? "",
      location: (formData.get("location") as string)?.trim() ?? "",
      employmentType: (formData.get("employmentType") as string) || "full_time",
      salaryMin: (formData.get("salaryMin") as string) ?? "",
      salaryMax: (formData.get("salaryMax") as string) ?? "",
      description: (formData.get("description") as string)?.trim() ?? "",
      requirements: (formData.get("requirements") as string)?.trim() ?? "",
    }
  );
  revalidatePath("/admin");
  revalidatePath("/hr/recruitment/jobs");
  revalidatePath("/hr/recruitment");
}

export async function approveWithPayloadEditsAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  const id = formData.get("id") as string;
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k !== "id" && typeof v === "string") values[k] = v;
  }
  await approveWithPayloadEdits(
    session.tenantId,
    id,
    { userId: session.userId, name: session.name },
    values
  );
  revalidatePath("/admin");
  revalidatePath("/hr/payroll");
  revalidatePath("/hr/payroll/runs"); revalidatePath("/hr/payroll");
}

export async function requestChangesAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  await requestChanges(
    session.tenantId,
    formData.get("id") as string,
    { userId: session.userId, name: session.name },
    (formData.get("recommendation") as string) || ""
  );
  revalidatePath("/admin");
  revalidatePath("/hr/recruitment/jobs");
}

export async function rejectRequestAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  await rejectRequest(
    session.tenantId,
    formData.get("id") as string,
    { userId: session.userId, name: session.name },
    (formData.get("reason") as string) || undefined
  );
  revalidatePath("/admin");
  revalidatePath("/hr/employees");
  revalidatePath("/hr/recruitment/pipeline");
  revalidatePath("/hr/recruitment/jobs");
}

// ─── Notification center ────────────────────────────────────

export async function markNotificationReadAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  await markNotificationRead(
    session.tenantId,
    session.userId,
    formData.get("id") as string
  );
  revalidatePath("/admin");
}

export async function markAllNotificationsReadAction() {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  ensureAdmin(session.role);
  await markAllNotificationsRead(session.tenantId, session.userId);
  revalidatePath("/admin");
}
