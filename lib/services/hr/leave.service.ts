import { prisma } from "../../db";
import type { LeaveStatus } from "@prisma/client";
import { assertTenantOwns } from "./_shared";
import { createApprovalRequest } from "../approvals.service";

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
  const requests = await prisma.leaveRequest.findMany({
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

  return requests.map((r) => ({
    ...r,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
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
  },
  actor?: { userId: string; name: string }
) {
  const days = calculateDays(input.startDate, input.endDate);
  if (input.endDate < input.startDate) {
    throw new Error("End date must be on or after the start date");
  }

  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "leaveType", [input.leaveTypeId]);

  const leave = await prisma.leaveRequest.create({
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

  const [emp, lt] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { fullName: true, empCode: true },
    }),
    prisma.leaveType.findUnique({
      where: { id: input.leaveTypeId },
      select: { name: true },
    }),
  ]);
  await createApprovalRequest({
    tenantId,
    type: "leave_request",
    entityType: "LeaveRequest",
    entityId: leave.id,
    title: emp ? `${emp.fullName} (${emp.empCode})` : "Leave request",
    subtitle: `${lt?.name ?? "Leave"} · ${days} day${days === 1 ? "" : "s"} · ${input.startDate.toLocaleDateString()}–${input.endDate.toLocaleDateString()}`,
    requestedBy: actor?.userId,
    requestedByName: actor?.name,
  });

  return leave;
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
