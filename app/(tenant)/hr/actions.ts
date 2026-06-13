"use server";

import { requireTenant } from "@/lib/auth";
import { resolveLinkedApproval } from "@/lib/services/approvals.service";
import {
  createEmployee,
  updateEmployee,
  terminateEmployee,
  deleteEmployee,
} from "@/lib/services/hr/employee.service";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createPosition,
  updatePosition,
  deletePosition,
} from "@/lib/services/hr/department.service";
import {
  createLeaveType,
  deleteLeaveType,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
} from "@/lib/services/hr/leave.service";
import { checkIn, checkOut } from "@/lib/services/hr/attendance.service";
import {
  startBreak,
  endBreak,
  createBreakPenalty,
  applyBreakPenalty,
  waiveBreakPenalty,
  deleteBreakPenalty,
  updateBreakTimeThreshold,
} from "@/lib/services/hr/break.service";
import { updateSystemSettings } from "@/lib/services/settings.service";
import { revalidatePath } from "next/cache";

// ─── Employees ──────────────────────────────────────────────

type EmployeeActionResult = { ok: boolean; error?: string };

export async function createEmployeeAction(
  formData: FormData
): Promise<EmployeeActionResult> {
  try {
    const session = await requireTenant();
    await createEmployee(
      session.tenantId,
      {
        fullName: formData.get("fullName") as string,
        email: formData.get("email") as string,
        phone: (formData.get("phone") as string) || undefined,
        dob: formData.get("dob") ? new Date(formData.get("dob") as string) : null,
        gender: (formData.get("gender") as string) || undefined,
        nationalId: (formData.get("nationalId") as string) || undefined,
        address: (formData.get("address") as string) || undefined,
        emergencyContact: (formData.get("emergencyContact") as string) || undefined,
        emergencyPhone: (formData.get("emergencyPhone") as string) || undefined,
        departmentId: (formData.get("departmentId") as string) || undefined,
        positionId: (formData.get("positionId") as string) || undefined,
        managerId: (formData.get("managerId") as string) || undefined,
        employmentType: (formData.get("employmentType") as any) ?? "full_time",
        hireDate: new Date(formData.get("hireDate") as string),
        baseSalary: formData.get("baseSalary")
          ? parseFloat(formData.get("baseSalary") as string)
          : undefined,
        currency: (formData.get("currency") as string) || "BDT",
      },
      { userId: session.userId, name: session.name }
    );
    revalidatePath("/hr/employees");
    revalidatePath("/hr");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create employee",
    };
  }
}

export async function updateEmployeeAction(
  formData: FormData
): Promise<EmployeeActionResult> {
  try {
    const session = await requireTenant();
    await updateEmployee(session.tenantId, {
      id: formData.get("id") as string,
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      departmentId: (formData.get("departmentId") as string) || undefined,
      positionId: (formData.get("positionId") as string) || undefined,
      managerId: (formData.get("managerId") as string) || undefined,
      employmentType: (formData.get("employmentType") as any) ?? undefined,
      baseSalary: formData.get("baseSalary")
        ? parseFloat(formData.get("baseSalary") as string)
        : undefined,
    });
    revalidatePath("/hr/employees");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update employee",
    };
  }
}

export async function terminateEmployeeAction(formData: FormData) {
  const session = await requireTenant();
  await terminateEmployee(
    session.tenantId,
    formData.get("id") as string,
    new Date(formData.get("terminationDate") as string),
    (formData.get("reason") as string) || undefined
  );
  revalidatePath("/hr/employees");
  revalidatePath("/hr");
}

export async function deleteEmployeeAction(formData: FormData) {
  const session = await requireTenant();
  await deleteEmployee(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/employees");
  revalidatePath("/hr");
}

// ─── Departments ────────────────────────────────────────────

export async function createDepartmentAction(formData: FormData) {
  const session = await requireTenant();
  await createDepartment(session.tenantId, {
    name: formData.get("name") as string,
    code: (formData.get("code") as string) || undefined,
    parentId: (formData.get("parentId") as string) || undefined,
    costCenter: (formData.get("costCenter") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  });
  revalidatePath("/hr/departments");
  revalidatePath("/hr");
}

export async function updateDepartmentAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireTenant();
    const id = formData.get("id") as string;
    if (!id) return { ok: false, error: "Missing department id" };
    const name = (formData.get("name") as string)?.trim();
    if (!name || name.length < 2)
      return { ok: false, error: "Name must be at least 2 characters" };

    await updateDepartment(session.tenantId, id, {
      name,
      code: (formData.get("code") as string)?.trim() || undefined,
      costCenter: (formData.get("costCenter") as string)?.trim() || undefined,
      description:
        (formData.get("description") as string)?.trim() || undefined,
    });
    revalidatePath("/hr/departments");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update department",
    };
  }
}

export async function deleteDepartmentAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireTenant();
    await deleteDepartment(session.tenantId, formData.get("id") as string);
    revalidatePath("/hr/departments");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete department",
    };
  }
}

// ─── Positions ──────────────────────────────────────────────

export async function createPositionAction(formData: FormData) {
  const session = await requireTenant();
  await createPosition(session.tenantId, {
    title: formData.get("title") as string,
    departmentId: (formData.get("departmentId") as string) || undefined,
    grade: (formData.get("grade") as string) || undefined,
    band: (formData.get("band") as string) || undefined,
    jobFamily: (formData.get("jobFamily") as string) || undefined,
    isManager: formData.get("isManager") === "on",
    description: (formData.get("description") as string) || undefined,
  });
  revalidatePath("/hr/positions");
}

export async function updatePositionAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireTenant();
    const id = formData.get("id") as string;
    if (!id) return { ok: false, error: "Missing position id" };
    const title = (formData.get("title") as string)?.trim();
    if (!title || title.length < 2)
      return { ok: false, error: "Title must be at least 2 characters" };

    await updatePosition(session.tenantId, id, {
      title,
      departmentId: (formData.get("departmentId") as string) || undefined,
      grade: (formData.get("grade") as string)?.trim() || undefined,
      band: (formData.get("band") as string)?.trim() || undefined,
      jobFamily: (formData.get("jobFamily") as string)?.trim() || undefined,
      isManager: formData.get("isManager") === "on",
      description: (formData.get("description") as string)?.trim() || undefined,
    });
    revalidatePath("/hr/positions");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update position",
    };
  }
}

export async function deletePositionAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireTenant();
    await deletePosition(session.tenantId, formData.get("id") as string);
    revalidatePath("/hr/positions");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete position",
    };
  }
}

// ─── Leave Types ────────────────────────────────────────────

export async function createLeaveTypeAction(formData: FormData) {
  const session = await requireTenant();
  await createLeaveType(session.tenantId, {
    name: formData.get("name") as string,
    code: formData.get("code") as string,
    description: (formData.get("description") as string) || undefined,
    annualEntitlement: formData.get("annualEntitlement")
      ? parseInt(formData.get("annualEntitlement") as string, 10)
      : 0,
    isPaid: formData.get("isPaid") === "on",
    requiresApproval: formData.get("requiresApproval") === "on",
    color: (formData.get("color") as string) || "#6366f1",
  });
  revalidatePath("/hr/leave/types");
}

export async function deleteLeaveTypeAction(formData: FormData) {
  const session = await requireTenant();
  await deleteLeaveType(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/leave/types");
}

// ─── Leave Requests ─────────────────────────────────────────

export async function createLeaveRequestAction(formData: FormData) {
  const session = await requireTenant();
  await createLeaveRequest(
    session.tenantId,
    {
      employeeId: formData.get("employeeId") as string,
      leaveTypeId: formData.get("leaveTypeId") as string,
      startDate: new Date(formData.get("startDate") as string),
      endDate: new Date(formData.get("endDate") as string),
      reason: (formData.get("reason") as string) || undefined,
    },
    { userId: session.userId, name: session.name }
  );
  revalidatePath("/hr/leave");
  revalidatePath("/hr");
  revalidatePath("/admin");
}

export async function approveLeaveAction(formData: FormData) {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  await approveLeaveRequest(session.tenantId, id, session.userId);
  // Keep the central /admin inbox consistent when decided from /hr/leave.
  await resolveLinkedApproval(session.tenantId, "leave_request", id, "approved", {
    userId: session.userId,
    name: session.name,
  });
  revalidatePath("/hr/leave");
  revalidatePath("/hr");
  revalidatePath("/admin");
}

export async function rejectLeaveAction(formData: FormData) {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string) || undefined;
  await rejectLeaveRequest(session.tenantId, id, session.userId, reason);
  await resolveLinkedApproval(
    session.tenantId,
    "leave_request",
    id,
    "rejected",
    { userId: session.userId, name: session.name },
    reason
  );
  revalidatePath("/hr/leave");
  revalidatePath("/hr");
  revalidatePath("/admin");
}

// ─── Attendance ─────────────────────────────────────────────

export async function checkInAction(formData: FormData) {
  const session = await requireTenant();
  await checkIn(session.tenantId, formData.get("employeeId") as string);
  revalidatePath("/hr/attendance");
  revalidatePath("/hr");
}

export async function checkOutAction(formData: FormData) {
  const session = await requireTenant();
  await checkOut(session.tenantId, formData.get("employeeId") as string);
  revalidatePath("/hr/attendance");
}

export async function updateLateThresholdAction(formData: FormData) {
  const session = await requireTenant();
  const raw = formData.get("lateThreshold") as string;
  await updateSystemSettings(session.tenantId, {
    lateThreshold: raw?.trim() || null,
  });
  revalidatePath("/hr/attendance");
}

// ─── Break Time ──────────────────────────────────────────────

export async function startBreakAction(formData: FormData) {
  const session = await requireTenant();
  const note = ((formData.get("note") as string | null) ?? "").trim();
  await startBreak(session.tenantId, formData.get("employeeId") as string, {
    note,
  });
  revalidatePath("/hr/break");
}

export async function endBreakAction(formData: FormData) {
  const session = await requireTenant();
  await endBreak(
    session.tenantId,
    formData.get("employeeId") as string,
    formData.get("breakSessionId") as string
  );
  revalidatePath("/hr/break");
}

export async function createBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  await createBreakPenalty(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    breakSessionId: (formData.get("breakSessionId") as string) || undefined,
    amount: parseFloat(formData.get("amount") as string),
    reason: formData.get("reason") as string,
    exceededMinutes: parseInt(formData.get("exceededMinutes") as string, 10) || 0,
  });
  revalidatePath("/hr/break");
}

export async function applyBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  await applyBreakPenalty(
    session.tenantId,
    formData.get("penaltyId") as string,
    session.userId
  );
  revalidatePath("/hr/break");
}

export async function waiveBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  await waiveBreakPenalty(session.tenantId, formData.get("penaltyId") as string);
  revalidatePath("/hr/break");
}

export async function deleteBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  await deleteBreakPenalty(session.tenantId, formData.get("penaltyId") as string);
  revalidatePath("/hr/break");
}

export async function updateBreakTimeThresholdAction(formData: FormData) {
  const session = await requireTenant();
  const minutes = parseInt(formData.get("breakTimeThreshold") as string, 10);
  if (isNaN(minutes) || minutes < 1) throw new Error("Invalid threshold value");
  await updateBreakTimeThreshold(session.tenantId, minutes);
  revalidatePath("/hr/break");
}
