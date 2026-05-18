import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

export async function listAttendance(
  tenantId: string,
  filters: { employeeId?: string; from?: Date; to?: Date } = {}
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      date: {
        gte: filters.from ?? monthStart,
        ...(filters.to && { lte: filters.to }),
      },
    },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}

const LATE_TO_ABSENCE_RATIO = 3;

function isAfterThreshold(now: Date, threshold: string): boolean {
  const [h, m] = threshold.split(":").map(Number);
  const thresholdMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > thresholdMinutes;
}

export async function checkIn(tenantId: string, employeeId: string) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { lateThreshold: true },
  });

  let status = "present";
  let notes: string | undefined;

  if (settings?.lateThreshold && isAfterThreshold(now, settings.lateThreshold)) {
    status = "late";
    const minutesLate = Math.floor(
      (now.getHours() * 60 + now.getMinutes()) -
        (parseInt(settings.lateThreshold.split(":")[0]) * 60 +
          parseInt(settings.lateThreshold.split(":")[1]))
    );
    notes = `Late by ${minutesLate} min (threshold: ${settings.lateThreshold})`;
  }

  return prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date: today } },
    update: {
      checkIn: now,
      status,
      notes,
    },
    create: {
      tenantId,
      employeeId,
      date: today,
      checkIn: now,
      status,
      notes,
    },
  });
}

export async function checkOut(tenantId: string, employeeId: string) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });

  if (!record || !record.checkIn) {
    throw new Error("Cannot check out without first checking in today");
  }

  const workMs = now.getTime() - record.checkIn.getTime();
  const workHours = Math.round((workMs / 3_600_000) * 100) / 100;

  return prisma.attendanceRecord.update({
    where: { employeeId_date: { employeeId, date: today } },
    data: {
      checkOut: now,
      workHours,
    },
  });
}

export async function getAttendanceStats(tenantId: string, date?: Date) {
  const targetDate = date ?? new Date();
  targetDate.setHours(0, 0, 0, 0);

  const [present, late, totalActive] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { tenantId, date: targetDate, status: "present" },
    }),
    prisma.attendanceRecord.count({
      where: { tenantId, date: targetDate, status: "late" },
    }),
    prisma.employee.count({ where: { tenantId, status: "active" } }),
  ]);

  const checkedIn = present + late;

  return {
    present,
    late,
    totalActive,
    absent: totalActive - checkedIn,
    attendanceRate: totalActive > 0 ? Math.round((checkedIn / totalActive) * 100) : 0,
  };
}

/**
 * Counts additional absent days from the "3 consecutive lates = 1 absence" rule.
 *
 * Scans attendance records for the given employee in the date range, finds runs
 * of consecutive late days, and returns floor(totalConsecutiveLates / 3).
 */
export async function countLateToAbsence(
  tenantId: string,
  employeeId: string,
  from: Date,
  to: Date
): Promise<number> {
  const lateRecords = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      employeeId,
      status: "late",
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  if (lateRecords.length === 0) return 0;

  let streak = 1;
  let totalAbsencesFromLate = 0;

  for (let i = 1; i < lateRecords.length; i++) {
    const prev = new Date(lateRecords[i - 1].date);
    const curr = new Date(lateRecords[i].date);
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      streak++;
    } else {
      totalAbsencesFromLate += Math.floor(streak / LATE_TO_ABSENCE_RATIO);
      streak = 1;
    }
  }

  totalAbsencesFromLate += Math.floor(streak / LATE_TO_ABSENCE_RATIO);

  return totalAbsencesFromLate;
}
