"use server";

import { requireTenant } from "@/lib/auth";
import {
  createEmployee,
  updateEmployee,
  terminateEmployee,
} from "@/lib/services/hr/employee.service";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createPosition,
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
import { revalidatePath } from "next/cache";

// ─── Employees ──────────────────────────────────────────────

export async function createEmployeeAction(formData: FormData) {
  const session = await requireTenant();
  await createEmployee(session.tenantId, {
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
  });
  revalidatePath("/hr/employees");
  revalidatePath("/hr");
}

export async function updateEmployeeAction(formData: FormData) {
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

export async function deleteDepartmentAction(formData: FormData) {
  const session = await requireTenant();
  await deleteDepartment(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/departments");
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

export async function deletePositionAction(formData: FormData) {
  const session = await requireTenant();
  await deletePosition(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/positions");
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
  await createLeaveRequest(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    leaveTypeId: formData.get("leaveTypeId") as string,
    startDate: new Date(formData.get("startDate") as string),
    endDate: new Date(formData.get("endDate") as string),
    reason: (formData.get("reason") as string) || undefined,
  });
  revalidatePath("/hr/leave");
  revalidatePath("/hr");
}

export async function approveLeaveAction(formData: FormData) {
  const session = await requireTenant();
  await approveLeaveRequest(session.tenantId, formData.get("id") as string, session.userId);
  revalidatePath("/hr/leave");
  revalidatePath("/hr");
}

export async function rejectLeaveAction(formData: FormData) {
  const session = await requireTenant();
  await rejectLeaveRequest(
    session.tenantId,
    formData.get("id") as string,
    session.userId,
    (formData.get("reason") as string) || undefined
  );
  revalidatePath("/hr/leave");
  revalidatePath("/hr");
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
