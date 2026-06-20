import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

// Per-employee custom schedule: the monthly off-day grid + lunch window.
// Off days are specific calendar dates (stored as @db.Date at UTC midnight). For
// employees with usesCustomSchedule = true these dates ARE their weekend and
// override the tenant-wide Friday in the working-day checker (holiday.service).

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Parse a "YYYY-MM-DD" string to a UTC-midnight Date (matches @db.Date). */
function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) throw new Error("Invalid date");
  return new Date(Date.UTC(y, m - 1, d));
}

export type ScheduleEmployeeRow = {
  employeeId: string;
  fullName: string;
  empCode: string;
  department: string | null;
  usesCustomSchedule: boolean;
  lunchStart: string | null;
  lunchEnd: string | null;
  offDates: string[]; // YYYY-MM-DD within the requested month
};

export type ScheduleHoliday = {
  dateISO: string; // YYYY-MM-DD within the month
  name: string;
  tentative: boolean;
};

export type ScheduleMonth = {
  year: number;
  month: number; // 1–12
  daysInMonth: number;
  weekendDays: number[]; // tenant default (0=Sun … 6=Sat)
  holidays: ScheduleHoliday[]; // company-wide holidays falling in this month
  employees: ScheduleEmployeeRow[];
};

/** Build the month grid: every active employee + their off dates that month. */
export async function getScheduleMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<ScheduleMonth> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0)); // last day of month
  const daysInMonth = to.getUTCDate();

  const [employees, settings, holidayRows] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId, status: "active" },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        empCode: true,
        usesCustomSchedule: true,
        lunchStart: true,
        lunchEnd: true,
        department: { select: { name: true } },
        offDays: {
          where: { offDate: { gte: from, lte: to } },
          select: { offDate: true },
        },
      },
    }),
    prisma.systemSettings.findUnique({
      where: { tenantId },
      select: { weekendDays: true },
    }),
    prisma.holiday.findMany({
      where: { tenantId },
      select: { date: true, name: true, isRecurring: true, isTentative: true },
    }),
  ]);

  // Resolve which days of THIS month are holidays. Fixed holidays match the exact
  // date; recurring ones match by MM-DD onto the requested year.
  const fixed = new Map<string, { name: string; tentative: boolean }>();
  const recurring = new Map<string, { name: string; tentative: boolean }>();
  for (const h of holidayRows) {
    const dk = dayKey(new Date(h.date));
    if (h.isRecurring) recurring.set(dk.slice(5), { name: h.name, tentative: h.isTentative });
    else fixed.set(dk, { name: h.name, tentative: h.isTentative });
  }
  const holidays: ScheduleHoliday[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = dayKey(new Date(Date.UTC(year, month - 1, d)));
    const hit = fixed.get(dk) ?? recurring.get(dk.slice(5));
    if (hit) holidays.push({ dateISO: dk, name: hit.name, tentative: hit.tentative });
  }

  return {
    year,
    month,
    daysInMonth,
    weekendDays: settings?.weekendDays?.length ? settings.weekendDays : [5],
    holidays,
    employees: employees.map((e) => ({
      employeeId: e.id,
      fullName: e.fullName,
      empCode: e.empCode,
      department: e.department?.name ?? null,
      usesCustomSchedule: e.usesCustomSchedule,
      lunchStart: e.lunchStart,
      lunchEnd: e.lunchEnd,
      offDates: e.offDays.map((o) => dayKey(new Date(o.offDate))),
    })),
  };
}

/** Toggle a single off date for an employee (add if absent, remove if present). */
export async function toggleOffDay(
  tenantId: string,
  employeeId: string,
  dateISO: string
): Promise<{ off: boolean }> {
  await assertTenantOwns(tenantId, "employee", [employeeId]);
  const offDate = toUtcDate(dateISO);

  const existing = await prisma.employeeOffDay.findFirst({
    where: { tenantId, employeeId, offDate },
    select: { id: true },
  });

  if (existing) {
    await prisma.employeeOffDay.delete({ where: { id: existing.id } });
    return { off: false };
  }
  await prisma.employeeOffDay.create({ data: { tenantId, employeeId, offDate } });
  return { off: true };
}

/** Set an employee's lunch window (HH:mm). Empty strings clear it. */
export async function setLunch(
  tenantId: string,
  employeeId: string,
  start: string | null,
  end: string | null
) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);
  await prisma.employee.update({
    where: { id: employeeId },
    data: { lunchStart: start?.trim() || null, lunchEnd: end?.trim() || null },
  });
}

/** Opt an employee in/out of the custom (per-date) schedule. When off, they
 *  fall back to the tenant weekend in attendance/payroll. */
export async function setCustomSchedule(
  tenantId: string,
  employeeId: string,
  enabled: boolean
) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);
  await prisma.employee.update({
    where: { id: employeeId },
    data: { usesCustomSchedule: enabled },
  });
}

/** Toggle ALL dates of one weekday (0=Sun … 6=Sat) in a month for an employee.
 *  If every such date is already off → clears them; otherwise marks them all off
 *  (additive with any manually-set dates). Returns the resulting state. */
export async function toggleWeekdayOff(
  tenantId: string,
  employeeId: string,
  year: number,
  month: number,
  weekday: number
): Promise<{ off: boolean }> {
  await assertTenantOwns(tenantId, "employee", [employeeId]);
  const to = new Date(Date.UTC(year, month, 0));
  const days = to.getUTCDate();

  const dates: Date[] = [];
  for (let d = 1; d <= days; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    if (dt.getUTCDay() === weekday) dates.push(dt);
  }
  if (dates.length === 0) return { off: false };

  const existing = await prisma.employeeOffDay.findMany({
    where: { tenantId, employeeId, offDate: { in: dates } },
    select: { offDate: true },
  });
  const existingKeys = new Set(existing.map((e) => dayKey(new Date(e.offDate))));
  const allOff = dates.every((d) => existingKeys.has(dayKey(d)));

  if (allOff) {
    await prisma.employeeOffDay.deleteMany({
      where: { tenantId, employeeId, offDate: { in: dates } },
    });
    return { off: false };
  }
  await prisma.$transaction([
    prisma.employeeOffDay.createMany({
      data: dates.map((offDate) => ({ tenantId, employeeId, offDate })),
      skipDuplicates: true,
    }),
    prisma.employee.update({
      where: { id: employeeId },
      data: { usesCustomSchedule: true },
    }),
  ]);
  return { off: true };
}

/** Copy one employee's off-weekday pattern across a whole month — a convenience
 *  for "every Sunday off" style setups without clicking each date. `weekdays`
 *  are 0=Sun … 6=Sat. Replaces that month's off dates for the employee. */
export async function applyWeekdayPattern(
  tenantId: string,
  employeeId: string,
  year: number,
  month: number,
  weekdays: number[]
) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  const days = to.getUTCDate();
  const want = new Set(weekdays.filter((d) => d >= 0 && d <= 6));

  const dates: Date[] = [];
  for (let d = 1; d <= days; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    if (want.has(dt.getUTCDay())) dates.push(dt);
  }

  await prisma.$transaction([
    prisma.employeeOffDay.deleteMany({
      where: { tenantId, employeeId, offDate: { gte: from, lte: to } },
    }),
    prisma.employeeOffDay.createMany({
      data: dates.map((offDate) => ({ tenantId, employeeId, offDate })),
      skipDuplicates: true,
    }),
    prisma.employee.update({
      where: { id: employeeId },
      data: { usesCustomSchedule: true },
    }),
  ]);
}