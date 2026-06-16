import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";
import type { BreakPenaltyStatus } from "@prisma/client";

export async function listBreakSessions(
  tenantId: string,
  filters: {
    employeeId?: string;
    from?: Date;
    to?: Date;
    status?: string;
  } = {}
) {
  return prisma.breakSession.findMany({
    where: {
      tenantId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.from || filters.to
        ? {
            breakStart: {
              ...(filters.from && { gte: filters.from }),
              ...(filters.to && { lte: filters.to }),
            },
          }
        : {}),
      ...(filters.status && { status: filters.status as any }),
    },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
    },
    orderBy: { breakStart: "desc" },
    take: 500,
  });
}

export type BreakCategory = "courier" | "personal";

// A break whose reason mentions "courier" is treated as a work errand — that
// time still counts as working/duty time. Anything else is an out-of-duty
// (non-working) break.
export function classifyBreakReason(reason: string): {
  category: BreakCategory;
  isDuty: boolean;
} {
  const isDuty = /courier/i.test(reason);
  return { category: isDuty ? "courier" : "personal", isDuty };
}

export async function startBreak(
  tenantId: string,
  employeeId: string,
  opts: { note: string }
) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  // A reason is required to start a break; mentioning "courier" marks it as
  // duty time, anything else is a personal (out-of-duty) break.
  const note = (opts.note ?? "").trim();
  if (!note) throw new Error("Please enter a reason for the break.");

  const { category, isDuty } = classifyBreakReason(note);

  const active = await prisma.breakSession.findFirst({
    where: { tenantId, employeeId, status: "active" },
  });
  if (active) throw new Error("You already have an active break. End it first.");

  return prisma.breakSession.create({
    data: {
      tenantId,
      employeeId,
      breakStart: new Date(),
      status: "active",
      breakCategory: category,
      isDuty,
      notes: note,
    },
  });
}

/**
 * Log a completed break for a specific time window ("from this time to that
 * time") instead of the live Start/End flow. Used to record a break that was
 * taken earlier, or for an admin to enter a break on an employee's behalf.
 * Creates an already-completed session with the duration computed from the
 * supplied start/end times.
 */
export async function logBreak(
  tenantId: string,
  employeeId: string,
  opts: { breakStart: Date; breakEnd: Date; note: string }
) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const note = (opts.note ?? "").trim();
  if (!note) throw new Error("Please enter a reason for the break.");

  if (!(opts.breakStart instanceof Date) || isNaN(opts.breakStart.getTime())) {
    throw new Error("Please enter a valid break start time.");
  }
  if (!(opts.breakEnd instanceof Date) || isNaN(opts.breakEnd.getTime())) {
    throw new Error("Please enter a valid break end time.");
  }
  if (opts.breakEnd.getTime() <= opts.breakStart.getTime()) {
    throw new Error("Break end time must be after the start time.");
  }
  if (opts.breakStart.getTime() > Date.now() + 60_000) {
    throw new Error("Break start time can't be in the future.");
  }

  const { category, isDuty } = classifyBreakReason(note);
  const durationMin =
    Math.round(
      ((opts.breakEnd.getTime() - opts.breakStart.getTime()) / 60000) * 100
    ) / 100;

  return prisma.breakSession.create({
    data: {
      tenantId,
      employeeId,
      breakStart: opts.breakStart,
      breakEnd: opts.breakEnd,
      durationMin,
      status: "completed",
      breakCategory: category,
      isDuty,
      notes: note,
    },
  });
}

/** Admin edit of a logged break session — adjust start/end times and reason;
 *  duration, status and duty classification are recomputed. */
export async function updateBreakSession(
  tenantId: string,
  id: string,
  data: { breakStart?: Date; breakEnd?: Date | null; note?: string }
) {
  const rec = await prisma.breakSession.findFirst({ where: { id, tenantId } });
  if (!rec) throw new Error("Break session not found");

  const breakStart = data.breakStart ?? rec.breakStart;
  const breakEnd = data.breakEnd !== undefined ? data.breakEnd : rec.breakEnd;
  const note =
    data.note !== undefined ? (data.note ?? "").trim() : rec.notes ?? "";

  if (breakEnd && breakEnd.getTime() <= breakStart.getTime()) {
    throw new Error("Break end time must be after the start time.");
  }

  const durationMin = breakEnd
    ? Math.round(((breakEnd.getTime() - breakStart.getTime()) / 60000) * 100) /
      100
    : 0;
  const { category, isDuty } = classifyBreakReason(note);

  return prisma.breakSession.update({
    where: { id },
    data: {
      breakStart,
      breakEnd,
      durationMin,
      status: breakEnd ? "completed" : "active",
      breakCategory: category,
      isDuty,
      notes: note || null,
    },
  });
}

export async function deleteBreakSession(tenantId: string, id: string) {
  const rec = await prisma.breakSession.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!rec) throw new Error("Break session not found");
  return prisma.breakSession.delete({ where: { id } });
}

export async function endBreak(
  tenantId: string,
  employeeId: string,
  breakSessionId: string
) {
  await assertTenantOwns(tenantId, "breakSession", [breakSessionId]);

  const session = await prisma.breakSession.findUnique({
    where: { id: breakSessionId },
  });
  if (!session || session.employeeId !== employeeId || session.status !== "active") {
    throw new Error("Break session not found or already completed.");
  }

  const breakEnd = new Date();
  const durationMin = Math.round(
    ((breakEnd.getTime() - session.breakStart.getTime()) / 60000) * 100
  ) / 100;

  return prisma.breakSession.update({
    where: { id: breakSessionId },
    data: {
      breakEnd,
      durationMin,
      status: "completed",
    },
  });
}

export async function getActiveBreak(tenantId: string, employeeId: string) {
  return prisma.breakSession.findFirst({
    where: { tenantId, employeeId, status: "active" },
    orderBy: { breakStart: "desc" },
  });
}

export async function getBreakStats(tenantId: string, date?: Date) {
  const targetDate = new Date(date ?? new Date());
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const [activeBreaks, completedToday, totalEmployees] = await Promise.all([
    prisma.breakSession.count({
      where: {
        tenantId,
        status: "active",
      },
    }),
    prisma.breakSession.aggregate({
      where: {
        tenantId,
        status: "completed",
        breakStart: { gte: targetDate, lt: nextDay },
      },
      _count: { _all: true },
      _avg: { durationMin: true },
    }),
    prisma.employee.count({ where: { tenantId, status: "active" } }),
  ]);

  return {
    activeBreaks,
    completedToday: (completedToday?._count?._all ?? 0) as number,
    avgDurationMin: Math.round(((completedToday?._avg?.durationMin ?? 0) as number) * 100) / 100,
    totalEmployees,
  };
}

export async function listBreakPenalties(
  tenantId: string,
  filters: { employeeId?: string; status?: BreakPenaltyStatus } = {}
) {
  return prisma.breakPenalty.findMany({
    where: {
      tenantId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.status && { status: filters.status }),
    },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
      breakSession: { select: { id: true, breakStart: true, breakEnd: true, durationMin: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function createBreakPenalty(
  tenantId: string,
  data: {
    employeeId: string;
    breakSessionId?: string;
    amount: number;
    reason: string;
    exceededMinutes?: number;
  }
) {
  await assertTenantOwns(tenantId, "employee", [data.employeeId]);

  return prisma.breakPenalty.create({
    data: {
      tenantId,
      employeeId: data.employeeId,
      breakSessionId: data.breakSessionId,
      amount: data.amount,
      reason: data.reason,
      exceededMinutes: data.exceededMinutes ?? 0,
      status: "pending",
    },
  });
}

export async function applyBreakPenalty(tenantId: string, penaltyId: string, appliedBy: string) {
  await assertTenantOwns(tenantId, "breakPenalty", [penaltyId]);

  return prisma.breakPenalty.update({
    where: { id: penaltyId },
    data: {
      status: "applied",
      appliedAt: new Date(),
      appliedBy,
    },
  });
}

export async function waiveBreakPenalty(tenantId: string, penaltyId: string) {
  await assertTenantOwns(tenantId, "breakPenalty", [penaltyId]);

  return prisma.breakPenalty.update({
    where: { id: penaltyId },
    data: { status: "waived" },
  });
}

export async function deleteBreakPenalty(tenantId: string, penaltyId: string) {
  await assertTenantOwns(tenantId, "breakPenalty", [penaltyId]);

  return prisma.breakPenalty.delete({ where: { id: penaltyId } });
}

export async function getPendingBreakPenaltiesForEmployee(
  tenantId: string,
  employeeId: string
) {
  return prisma.breakPenalty.findMany({
    where: {
      tenantId,
      employeeId,
      status: "pending",
      payslipId: null,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getBreakTimeThreshold(tenantId: string): Promise<number> {
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { breakTimeThreshold: true },
  });
  return settings?.breakTimeThreshold ?? 60;
}

export async function updateBreakTimeThreshold(
  tenantId: string,
  breakTimeThreshold: number
) {
  return prisma.systemSettings.upsert({
    where: { tenantId },
    update: { breakTimeThreshold },
    create: { tenantId, breakTimeThreshold },
  });
}
