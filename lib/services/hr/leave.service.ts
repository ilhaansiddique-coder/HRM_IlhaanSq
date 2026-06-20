import { prisma } from "../../db";
import type { LeaveStatus } from "@prisma/client";
import { assertTenantOwns } from "./_shared";
import { createApprovalRequest } from "../approvals.service";
import { getWorkingDayChecker } from "./holiday.service";

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
  filters: {
    status?: LeaveStatus;
    employeeId?: string;
    from?: Date;
    to?: Date;
  } = {}
) {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      ...(filters.status && { status: filters.status }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...((filters.from || filters.to) && {
        createdAt: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to }),
        },
      }),
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

/** Working days in [start, end] inclusive, excluding the configured weekend +
 *  holidays. Falls back to ≥1 so a single off-day request still counts as 1. */
function countLeaveDays(
  start: Date,
  end: Date,
  isWorkingDay: (d: Date) => boolean
): number {
  const s = new Date(new Date(start).setHours(0, 0, 0, 0));
  const e = new Date(new Date(end).setHours(0, 0, 0, 0));
  let count = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(new Date(d))) count++;
  }
  return Math.max(1, count);
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
  if (input.endDate < input.startDate) {
    throw new Error("End date must be on or after the start date");
  }

  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "leaveType", [input.leaveTypeId]);

  // Count only working days — weekends + holidays don't consume leave balance.
  // Uses the employee's own off-day schedule when they're custom-scheduled.
  const wd = await getWorkingDayChecker(tenantId);
  const days = countLeaveDays(input.startDate, input.endDate, (d) =>
    wd.isWorkingDay(d, input.employeeId)
  );

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
