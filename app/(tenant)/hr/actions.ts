"use server";

import { requireTenant } from "@/lib/auth";
import { setRequestActor } from "@/lib/request-actor";
import { prisma } from "@/lib/db";
import { resolveLinkedApproval } from "@/lib/services/approvals.service";
import { onboardEmployeeWithPassword } from "@/lib/services/employee-onboarding.service";
import {
  createEmployee,
  updateEmployee,
  terminateEmployee,
  deleteEmployee,
} from "@/lib/services/hr/employee.service";
import {
  getEmployeeProfile,
  type EmployeeProfile,
} from "@/lib/services/hr/employee-profile.service";
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
import {
  checkIn,
  checkOut,
  updateAttendanceRecord,
  deleteAttendanceRecord,
} from "@/lib/services/hr/attendance.service";
import {
  startBreak,
  endBreak,
  logBreak,
  updateBreakSession,
  deleteBreakSession,
  createBreakPenalty,
  applyBreakPenalty,
  waiveBreakPenalty,
  deleteBreakPenalty,
  updateBreakTimeThreshold,
} from "@/lib/services/hr/break.service";
import { updateSystemSettings } from "@/lib/services/settings.service";
import { revalidatePath } from "next/cache";

// ─── Employees ──────────────────────────────────────────────

type EmployeeActionResult = {
  ok: boolean;
  error?: string;
  // When the admin set a temporary password at creation, this carries the
  // login credentials to hand over (password only present for a NEW account).
  login?: { email: string; tempPassword: string | null; reused: boolean };
};

// Read-only aggregated "at a glance" profile for the employee details dialog.
export async function getEmployeeProfileAction(
  id: string
): Promise<EmployeeProfile | null> {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  return getEmployeeProfile(session.tenantId, id);
}

export async function createEmployeeAction(
  formData: FormData
): Promise<EmployeeActionResult> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });

    const tempPassword = ((formData.get("tempPassword") as string | null) ?? "").trim();
    if (tempPassword && tempPassword.length < 6) {
      return {
        ok: false,
        error: "Temporary password must be at least 6 characters.",
      };
    }
    // The temp password lets the employee sign in — but they log in with their
    // email, so a password without an email can't work.
    const emailForLogin = ((formData.get("email") as string | null) ?? "").trim();
    if (tempPassword && !emailForLogin) {
      return {
        ok: false,
        error:
          "Add an email address — it's the employee's sign-in ID for the temporary password.",
      };
    }

    const employee = await createEmployee(
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

    let login: EmployeeActionResult["login"];
    if (tempPassword) {
      // Admin chose a temp password → provision login + activate immediately so
      // the employee can sign in right away (forced to reset it on first login).
      login = await onboardEmployeeWithPassword(
        session.tenantId,
        employee.id,
        tempPassword,
        { userId: session.userId, name: session.name }
      );
    }

    revalidatePath("/hr/employees");
    revalidatePath("/hr");
    revalidatePath("/admin");
    return { ok: true, login };
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
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await deleteEmployee(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/employees");
  revalidatePath("/hr");
}

// ─── Departments ────────────────────────────────────────────

export async function createDepartmentAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await deleteLeaveType(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/leave/types");
}

// ─── Leave Requests ─────────────────────────────────────────

export async function createLeaveRequestAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  const isAdmin = ["owner", "admin", "superadmin"].includes(session.role ?? "");

  // Non-admins may only file leave for THEIR OWN linked employee record — never
  // trust the employeeId posted from the form. Admins can file for anyone.
  let employeeId = formData.get("employeeId") as string;
  if (!isAdmin) {
    const me = await prisma.employee.findFirst({
      where: { tenantId: session.tenantId, userId: session.userId },
      select: { id: true },
    });
    if (!me) throw new Error("Your account isn't linked to an employee record.");
    employeeId = me.id;
  }

  await createLeaveRequest(
    session.tenantId,
    {
      employeeId,
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await checkIn(session.tenantId, formData.get("employeeId") as string);
  revalidatePath("/hr/attendance");
  revalidatePath("/hr");
}

export async function checkOutAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await checkOut(session.tenantId, formData.get("employeeId") as string);
  revalidatePath("/hr/attendance");
}

export async function updateAttendanceAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const checkInRaw = (formData.get("checkIn") as string)?.trim();
    const checkOutRaw = (formData.get("checkOut") as string)?.trim();
    await updateAttendanceRecord(session.tenantId, formData.get("id") as string, {
      checkIn: checkInRaw ? new Date(checkInRaw) : null,
      checkOut: checkOutRaw ? new Date(checkOutRaw) : null,
      status: (formData.get("status") as string) || undefined,
    });
    revalidatePath("/hr/attendance");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update record",
    };
  }
}

export async function deleteAttendanceAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await deleteAttendanceRecord(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/attendance");
  revalidatePath("/hr");
}

export async function updateLateThresholdAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  const raw = formData.get("lateThreshold") as string;
  await updateSystemSettings(session.tenantId, {
    lateThreshold: raw?.trim() || null,
  });
  revalidatePath("/hr/attendance");
}

// ─── Break Time ──────────────────────────────────────────────

export async function startBreakAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  const note = ((formData.get("note") as string | null) ?? "").trim();
  await startBreak(session.tenantId, formData.get("employeeId") as string, {
    note,
  });
  revalidatePath("/hr/break");
}

export async function endBreakAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await endBreak(
    session.tenantId,
    formData.get("employeeId") as string,
    formData.get("breakSessionId") as string
  );
  revalidatePath("/hr/break");
}

export async function logBreakAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await logBreak(session.tenantId, formData.get("employeeId") as string, {
    breakStart: new Date(formData.get("breakStart") as string),
    breakEnd: new Date(formData.get("breakEnd") as string),
    note: ((formData.get("note") as string | null) ?? "").trim(),
  });
  revalidatePath("/hr/break");
}

export async function updateBreakSessionAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireTenant();
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const startRaw = (formData.get("breakStart") as string)?.trim();
    const endRaw = (formData.get("breakEnd") as string)?.trim();
    await updateBreakSession(session.tenantId, formData.get("id") as string, {
      breakStart: startRaw ? new Date(startRaw) : undefined,
      breakEnd: endRaw ? new Date(endRaw) : null,
      note: (formData.get("note") as string) ?? undefined,
    });
    revalidatePath("/hr/break");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update break",
    };
  }
}

export async function deleteBreakSessionAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await deleteBreakSession(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/break");
}

export async function createBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
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
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await applyBreakPenalty(
    session.tenantId,
    formData.get("penaltyId") as string,
    session.userId
  );
  revalidatePath("/hr/break");
}

export async function waiveBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await waiveBreakPenalty(session.tenantId, formData.get("penaltyId") as string);
  revalidatePath("/hr/break");
}

export async function deleteBreakPenaltyAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  await deleteBreakPenalty(session.tenantId, formData.get("penaltyId") as string);
  revalidatePath("/hr/break");
}

export async function updateBreakTimeThresholdAction(formData: FormData) {
  const session = await requireTenant();
  setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
  const minutes = parseInt(formData.get("breakTimeThreshold") as string, 10);
  if (isNaN(minutes) || minutes < 1) throw new Error("Invalid threshold value");
  await updateBreakTimeThreshold(session.tenantId, minutes);
  revalidatePath("/hr/break");
}
