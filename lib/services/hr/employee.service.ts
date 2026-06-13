import { prisma } from "../../db";
import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import { assertTenantOwns } from "./_shared";
import { createApprovalRequest } from "../approvals.service";

export type CreateEmployeeInput = {
  empCode?: string;
  fullName: string;
  email: string;
  phone?: string;
  dob?: Date | null;
  gender?: string;
  nationalId?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  employmentType?: EmploymentType;
  hireDate: Date;
  baseSalary?: number;
  currency?: string;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  id: string;
  status?: EmploymentStatus;
};

async function generateEmpCode(tenantId: string): Promise<string> {
  const last = await prisma.employee.findFirst({
    where: { tenantId, empCode: { startsWith: "EMP" } },
    orderBy: { empCode: "desc" },
    select: { empCode: true },
  });

  let next = 1;
  if (last?.empCode) {
    const num = parseInt(last.empCode.replace("EMP", ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `EMP${String(next).padStart(4, "0")}`;
}

export async function listEmployees(
  tenantId: string,
  filters: { status?: EmploymentStatus; departmentId?: string; search?: string } = {}
) {
  const employees = await prisma.employee.findMany({
    where: {
      tenantId,
      ...(filters.status && { status: filters.status }),
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.search && {
        OR: [
          { fullName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { empCode: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, title: true } },
      manager: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return employees.map((e) => ({
    ...e,
    baseSalary: e.baseSalary ? Number(e.baseSalary) : null,
    dob: e.dob ? e.dob.toISOString() : null,
    hireDate: e.hireDate.toISOString(),
    terminationDate: e.terminationDate ? e.terminationDate.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));
}

export async function getEmployee(tenantId: string, id: string) {
  return prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      department: true,
      position: true,
      manager: { select: { id: true, fullName: true, empCode: true } },
      reports: { select: { id: true, fullName: true, empCode: true } },
    },
  });
}

export async function createEmployee(
  tenantId: string,
  input: CreateEmployeeInput,
  actor?: { userId: string; name: string }
) {
  await assertTenantOwns(tenantId, "department", [input.departmentId]);
  await assertTenantOwns(tenantId, "position", [input.positionId]);
  await assertTenantOwns(tenantId, "employee", [input.managerId]);

  // Employees must have a unique email AND phone within the tenant — the
  // email becomes their login identity for the self-service portal.
  const email = input.email.toLowerCase().trim();
  const phone = input.phone?.trim() || null;
  const dupe = await prisma.employee.findFirst({
    where: {
      tenantId,
      OR: [{ email }, ...(phone ? [{ phone }] : [])],
    },
    select: { email: true, phone: true, fullName: true, empCode: true },
  });
  if (dupe) {
    const who = `${dupe.fullName} (${dupe.empCode})`;
    if (dupe.email === email) {
      throw new Error(
        `This email is already used by ${who}. Each employee needs a unique email — it's their login for the staff portal. Use a different email address, or edit that existing employee instead of creating a new one.`
      );
    }
    throw new Error(
      `This phone number is already used by ${who}. Use a different phone number, or update that employee's record instead of creating a duplicate.`
    );
  }

  const empCode = input.empCode || (await generateEmpCode(tenantId));

  // Onboarding gate: a new employee is created PENDING and suspended, so it
  // is excluded from payroll/attendance/active dropdowns (all of which filter
  // status = "active") until an owner/admin approves it in /admin.
  const employee = await prisma.employee.create({
    data: {
      tenantId,
      empCode,
      fullName: input.fullName,
      email,
      phone,
      dob: input.dob ?? null,
      gender: input.gender,
      nationalId: input.nationalId,
      address: input.address,
      emergencyContact: input.emergencyContact,
      emergencyPhone: input.emergencyPhone,
      departmentId: input.departmentId || null,
      positionId: input.positionId || null,
      managerId: input.managerId || null,
      employmentType: input.employmentType ?? "full_time",
      status: "suspended",
      approvalStatus: "pending",
      hireDate: input.hireDate,
      baseSalary: input.baseSalary,
      currency: input.currency ?? "BDT",
    },
  });

  await createApprovalRequest({
    tenantId,
    type: "employee_onboarding",
    entityType: "Employee",
    entityId: employee.id,
    title: `${employee.fullName} (${employee.empCode})`,
    subtitle: employee.email,
    requestedBy: actor?.userId,
    requestedByName: actor?.name,
  });

  return employee;
}

export async function updateEmployee(tenantId: string, input: UpdateEmployeeInput) {
  const existing = await prisma.employee.findFirst({
    where: { id: input.id, tenantId },
  });
  if (!existing) throw new Error("Employee not found");

  if (input.departmentId !== undefined) {
    await assertTenantOwns(tenantId, "department", [input.departmentId]);
  }
  if (input.positionId !== undefined) {
    await assertTenantOwns(tenantId, "position", [input.positionId]);
  }
  if (input.managerId !== undefined) {
    if (input.managerId === input.id) throw new Error("Employee cannot manage themselves");
    await assertTenantOwns(tenantId, "employee", [input.managerId]);
  }

  const { id, ...data } = input;
  return prisma.employee.update({
    where: { id },
    data: {
      ...data,
      email: data.email ? data.email.toLowerCase().trim() : undefined,
    },
  });
}

export async function terminateEmployee(
  tenantId: string,
  id: string,
  terminationDate: Date,
  reason?: string
) {
  const existing = await prisma.employee.findFirst({
    where: { id, tenantId },
  });
  if (!existing) throw new Error("Employee not found");

  return prisma.employee.update({
    where: { id },
    data: {
      status: "terminated",
      terminationDate,
      terminationReason: reason,
    },
  });
}

export async function getEmployeeStats(tenantId: string) {
  const [total, active, onLeave, terminated, byDept] = await Promise.all([
    prisma.employee.count({ where: { tenantId } }),
    prisma.employee.count({ where: { tenantId, status: "active" } }),
    prisma.employee.count({ where: { tenantId, status: "on_leave" } }),
    prisma.employee.count({ where: { tenantId, status: "terminated" } }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { tenantId, status: "active" },
      _count: true,
    }),
  ]);

  return { total, active, onLeave, terminated, byDept };
}

export async function deleteEmployee(tenantId: string, id: string) {
  const existing = await prisma.employee.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) throw new Error("Employee not found");

  return prisma.$transaction([
    prisma.leaveRequest.deleteMany({ where: { employeeId: id } }),
    prisma.leaveBalance.deleteMany({ where: { employeeId: id } }),
    prisma.attendanceRecord.deleteMany({ where: { employeeId: id } }),
    prisma.breakSession.deleteMany({ where: { employeeId: id } }),
    prisma.breakPenalty.deleteMany({ where: { employeeId: id } }),
    prisma.employeeAdvance.deleteMany({ where: { employeeId: id } }),
    prisma.employeeDocument.deleteMany({ where: { employeeId: id } }),
    prisma.employeeSalary.deleteMany({ where: { employeeId: id } }),
    prisma.enrollment.deleteMany({ where: { employeeId: id } }),
    prisma.goal.deleteMany({ where: { employeeId: id } }),
    prisma.review.deleteMany({
      where: { OR: [{ employeeId: id }, { reviewerId: id }] },
    }),
    prisma.employee.updateMany({ where: { managerId: id }, data: { managerId: null } }),
    prisma.employee.delete({ where: { id } }),
  ]);
}
