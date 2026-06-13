import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";
import { createNotification } from "../notifications-center.service";

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
// Office starts 09:00 — check-in after this is "late" unless an admin
// overrides it via the Late Threshold setting.
const DEFAULT_LATE_THRESHOLD = "09:00";

// Friday is the weekly holiday. AttendanceRecord.date is a DATE column
// (stored at UTC midnight), so use getUTCDay() (Sun=0 … Fri=5 … Sat=6) to
// avoid timezone drift.
export const WEEKLY_HOLIDAY_DOW = 5;
export function isWeeklyHoliday(date: Date | string): boolean {
  return new Date(date).getUTCDay() === WEEKLY_HOLIDAY_DOW;
}

// ─── Timezone-correct "business day" helpers ────────────────
// The server may run in any timezone (here: Asia/Dhaka) while Prisma stores
// `@db.Date` by UTC date — naive `new Date(); setHours(0,0,0,0)` filed
// records under the WRONG calendar day. Everything below derives the
// calendar date / wall-clock minute in the TENANT's configured timezone and
// stores the date as UTC-midnight of that calendar date, which is stable
// regardless of server tz and reads back as the same day everywhere.

function zonedParts(tz: string, at: Date = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(at)) p[part.type] = part.value;
  let hour = Number(p.hour);
  if (hour === 24) hour = 0; // some envs emit "24" for midnight
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour,
    minute: Number(p.minute),
  };
}

/** UTC-midnight Date of the tenant-local calendar date — the value used for
 *  the AttendanceRecord.date column. Stable across server timezones. */
export function businessDate(tz: string, at: Date = new Date()): Date {
  const { year, month, day } = zonedParts(tz, at);
  return new Date(Date.UTC(year, month - 1, day));
}

function zonedMinutes(tz: string, at: Date = new Date()): number {
  const { hour, minute } = zonedParts(tz, at);
  return hour * 60 + minute;
}

async function tenantTimezone(tenantId: string): Promise<string> {
  const s = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { timezone: true },
  });
  return s?.timezone?.trim() || "UTC";
}

/** Today's attendance date key (UTC-midnight of the tenant-local day) — used
 *  by pages to match "today's" record consistently with how it was filed. */
export async function getAttendanceDayKey(tenantId: string): Promise<Date> {
  return businessDate(await tenantTimezone(tenantId));
}

export async function checkIn(tenantId: string, employeeId: string) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const now = new Date();
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { lateThreshold: true, timezone: true },
  });
  const tz = settings?.timezone?.trim() || "UTC";
  const today = businessDate(tz, now); // UTC-midnight of tenant-local date
  const threshold = settings?.lateThreshold?.trim() || DEFAULT_LATE_THRESHOLD;
  const [th, tm] = threshold.split(":").map(Number);
  const thresholdMinutes = th * 60 + tm;
  const nowMinutes = zonedMinutes(tz, now);

  let status = "present";
  let notes: string | undefined;
  let lateMinutes = 0;

  if (isWeeklyHoliday(today)) {
    // Working the weekly holiday (Friday) → never late; counts as an extra
    // duty day in payroll.
    status = "present";
    notes = "Worked on weekly holiday (Friday) — counts as extra duty";
  } else if (nowMinutes > thresholdMinutes) {
    status = "late";
    lateMinutes = nowMinutes - thresholdMinutes;
    notes = `Late by ${lateMinutes} min (office time ${threshold})`;
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date: today } },
    update: { checkIn: now, status, notes },
    create: { tenantId, employeeId, date: today, checkIn: now, status, notes },
  });

  if (status === "late") {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullName: true, empCode: true },
    });
    await createNotification({
      tenantId,
      category: "activity",
      type: "attendance.late",
      title: "Late check-in",
      body: `${emp?.fullName ?? "An employee"}${
        emp?.empCode ? ` (${emp.empCode})` : ""
      } checked in late by ${lateMinutes} min (office time ${threshold}).`,
      entityType: "AttendanceRecord",
      entityId: record.id,
      link: "/hr/attendance",
      severity: "warning",
    });
  }

  return record;
}

export async function checkOut(tenantId: string, employeeId: string) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const now = new Date();
  const tz = await tenantTimezone(tenantId);
  const today = businessDate(tz, now);

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
  // "Today" must be the tenant-local business day (UTC-midnight key) so it
  // matches how check-in filed the record. Records store date at UTC
  // midnight — do NOT setHours() (that re-introduces the tz shift).
  const targetDate = date
    ? new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate()
        )
      )
    : await getAttendanceDayKey(tenantId);

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
 * Late → absence rule (per the agreed policy):
 *
 *   Within EACH calendar month, every 3 late days = 1 absent day
 *   (floor(monthlyLateCount / 3)).
 *
 * This single monthly rule subsumes both stated cases:
 *   • "3 late in a row" — guaranteed to hit 3 within the month → 1 absence
 *     (the 4th day effectively absent).
 *   • "3 late in the whole month" (not necessarily consecutive) → 1 absence.
 * It is NOT double-counted (consecutive lateness is not charged twice).
 *
 * Friday is the weekly holiday and is excluded (a Friday is never "late").
 * Returns a detailed breakdown so the payslip can describe the rule.
 */
export async function countLateToAbsence(
  tenantId: string,
  employeeId: string,
  from: Date,
  to: Date
): Promise<number> {
  return (await getLateToAbsenceDetail(tenantId, employeeId, from, to))
    .absenceDays;
}

export async function getLateToAbsenceDetail(
  tenantId: string,
  employeeId: string,
  from: Date,
  to: Date
): Promise<{
  lateDays: number;
  absenceDays: number;
  perMonth: { month: string; lates: number; absences: number }[];
}> {
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

  // Bucket by calendar month (UTC — date is a DATE column). Skip the weekly
  // holiday defensively.
  const monthly = new Map<string, number>();
  for (const r of lateRecords) {
    const d = new Date(r.date);
    if (isWeeklyHoliday(d)) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly.set(key, (monthly.get(key) ?? 0) + 1);
  }

  let lateDays = 0;
  let absenceDays = 0;
  const perMonth: { month: string; lates: number; absences: number }[] = [];
  for (const [month, lates] of [...monthly.entries()].sort()) {
    const absences = Math.floor(lates / LATE_TO_ABSENCE_RATIO);
    lateDays += lates;
    absenceDays += absences;
    perMonth.push({ month, lates, absences });
  }

  return { lateDays, absenceDays, perMonth };
}

/**
 * Batched version of {@link countLateToAbsence} for MANY employees in one query
 * (avoids the N+1 pattern in getPayrollPrep). Returns a Map of employeeId →
 * late-derived absence days. The bucketing + floor(lates / ratio) per month is
 * identical to getLateToAbsenceDetail, so results match the single-employee path.
 */
export async function countLateToAbsenceBatch(
  tenantId: string,
  employeeIds: string[],
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  if (employeeIds.length === 0) return new Map();

  const lateRecords = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      employeeId: { in: employeeIds },
      status: "late",
      date: { gte: from, lte: to },
    },
    select: { employeeId: true, date: true },
  });

  // employeeId → monthKey → late count (skip the weekly holiday defensively).
  const perEmpMonth = new Map<string, Map<string, number>>();
  for (const r of lateRecords) {
    const d = new Date(r.date);
    if (isWeeklyHoliday(d)) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let months = perEmpMonth.get(r.employeeId);
    if (!months) {
      months = new Map();
      perEmpMonth.set(r.employeeId, months);
    }
    months.set(key, (months.get(key) ?? 0) + 1);
  }

  const result = new Map<string, number>();
  for (const [empId, months] of perEmpMonth) {
    let absenceDays = 0;
    for (const lates of months.values()) {
      absenceDays += Math.floor(lates / LATE_TO_ABSENCE_RATIO);
    }
    result.set(empId, absenceDays);
  }
  return result;
}

// Per-employee attendance summary + the raw rows, for the employee portal
// (calendar + counts). Defaults to the last ~3 calendar months.
export async function getEmployeeAttendanceSummary(
  tenantId: string,
  employeeId: string,
  from?: Date,
  to?: Date
) {
  const now = new Date();
  const start =
    from ?? new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const end = to ?? now;

  const rows = await prisma.attendanceRecord.findMany({
    where: { tenantId, employeeId, date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      status: true,
      checkIn: true,
      checkOut: true,
      workHours: true,
      notes: true,
    },
    take: 400,
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  let holidayWorked = 0;
  for (const r of rows) {
    if (isWeeklyHoliday(r.date) && r.checkIn) holidayWorked++;
    else if (r.status === "late") late++;
    else if (r.status === "absent") absent++;
    else if (r.status === "present" || r.checkIn) present++;
  }

  return {
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    counts: { present, late, absent, holidayWorked, total: rows.length },
    records: rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      status: r.status,
      checkIn: r.checkIn ? r.checkIn.toISOString() : null,
      checkOut: r.checkOut ? r.checkOut.toISOString() : null,
      workHours: r.workHours ? Number(r.workHours) : null,
      notes: r.notes,
      isHoliday: isWeeklyHoliday(r.date),
    })),
  };
}
