import { prisma } from "../../db";
import type { LeaveStatus } from "@prisma/client";
import { assertTenantOwns } from "./_shared";

// ─── Leave Types ────────────────────────────────────────────

export async function listLeaveTypes(tenantId: string) {
  return prisma.leaveType.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createLeaveType(
  tenantId: string,
  input: {
    name: string;
    code: string;
    description?: string;
    annualEntitlement?: number;
    isPaid?: boolean;
    requiresApproval?: boolean;
    color?: string;
  }
) {
  return prisma.leaveType.create({
    data: {
      tenantId,
      name: input.name,
      code: input.code.toUpperCase(),
      description: input.description,
      annualEntitlement: input.annualEntitlement ?? 0,
      isPaid: input.isPaid ?? true,
      requiresApproval: input.requiresApproval ?? true,
      color: input.color ?? "#6366f1",
    },
  });
}

export async function deleteLeaveType(tenantId: string, id: string) {
  const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("Leave type not found");
  await prisma.leaveType.delete({ where: { id } });
}

// ─── Leave Requests ─────────────────────────────────────────

export async function listLeaveRequests(
  tenantId: string,
  filters: { status?: LeaveStatus; employeeId?: string } = {}
) {
  return prisma.leaveRequest.findMany({
    where: {
      tenantId,
      ...(filters.status && { status: filters.status }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
    },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true, email: true } },
      leaveType: { select: { id: true, name: true, code: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

function calculateDays(start: Date, end: Date): number {
  const startMs = new Date(start).setHours(0, 0, 0, 0);
  const endMs = new Date(end).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
}

export async function createLeaveRequest(
  tenantId: string,
  input: {
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    reason?: string;
  }
) {
  const days = calculateDays(input.startDate, input.endDate);
  if (input.endDate < input.startDate) {
    throw new Error("End date must be on or after the start date");
  }

  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "leaveType", [input.leaveTypeId]);

  return prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason,
      status: "pending",
    },
  });
}

export async function approveLeaveRequest(
  tenantId: string,
  id: string,
  approverId: string
) {
  const req = await prisma.leaveRequest.findFirst({ where: { id, tenantId } });
  if (!req) throw new Error("Leave request not found");
  if (req.status !== "pending") throw new Error("Already reviewed");

  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "approved",
      approvedBy: approverId,
      approvedAt: new Date(),
    },
  });
}

export async function rejectLeaveRequest(
  tenantId: string,
  id: string,
  approverId: string,
  reason?: string
) {
  const req = await prisma.leaveRequest.findFirst({ where: { id, tenantId } });
  if (!req) throw new Error("Leave request not found");
  if (req.status !== "pending") throw new Error("Already reviewed");

  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "rejected",
      approvedBy: approverId,
      approvedAt: new Date(),
      rejectionReason: reason,
    },
  });
}
