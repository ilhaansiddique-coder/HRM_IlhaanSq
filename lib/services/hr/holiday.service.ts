import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";
import type { HolidayType } from "@prisma/client";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function mmdd(d: Date) {
  return d.toISOString().slice(5, 10); // MM-DD
}

// ─── Weekend configuration ──────────────────────────────────

/** Weekly off days (0=Sun … 6=Sat). Defaults to Friday for Bangladesh. */
export async function getWeekendDays(tenantId: string): Promise<number[]> {
  const s = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { weekendDays: true },
  });
  return s?.weekendDays?.length ? s.weekendDays : [5];
}

export async function setWeekendDays(tenantId: string, days: number[]) {
  const clean = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort();
  return prisma.systemSettings.upsert({
    where: { tenantId },
    create: { tenantId, weekendDays: clean },
    update: { weekendDays: clean },
  });
}

export function isWeekend(date: Date | string, weekendDays: number[]): boolean {
  return weekendDays.includes(new Date(date).getUTCDay());
}

// ─── Holidays ───────────────────────────────────────────────

export async function listHolidays(tenantId: string, year?: number) {
  const all = await prisma.holiday.findMany({
    where: { tenantId },
    orderBy: { date: "asc" },
  });
  if (!year) return all;
  // Map recurring holidays onto the requested year; keep non-recurring as stored.
  return all
    .map((h) => {
      if (!h.isRecurring) return h;
      const d = new Date(h.date);
      return { ...h, date: new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate())) };
    })
    .filter((h) => new Date(h.date).getUTCFullYear() === year)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

export async function createHoliday(
  tenantId: string,
  input: { date: Date; name: string; type?: HolidayType; isRecurring?: boolean; isTentative?: boolean }
) {
  if (!input.name?.trim()) throw new Error("Holiday name is required");
  return prisma.holiday.create({
    data: {
      tenantId,
      date: input.date,
      name: input.name.trim(),
      type: input.type ?? "public",
      isRecurring: input.isRecurring ?? false,
      isTentative: input.isTentative ?? false,
    },
  });
}

/**
 * Add a multi-day holiday block (e.g. an Eid window) — one Holiday row per day in
 * [startDate, endDate]. Always non-recurring (lunar dates move yearly). Mark
 * `isTentative` while the moon-sighting date is unconfirmed; confirm/adjust later.
 */
export async function createHolidayRange(
  tenantId: string,
  input: {
    startDate: Date;
    endDate: Date;
    name: string;
    type?: HolidayType;
    isTentative?: boolean;
  }
): Promise<number> {
  if (!input.name?.trim()) throw new Error("Holiday name is required");
  if (input.endDate < input.startDate) {
    throw new Error("End date must be on or after the start date");
  }
  const name = input.name.trim();
  const type = input.type ?? "public";
  const isTentative = input.isTentative ?? false;

  const cur = new Date(
    Date.UTC(
      input.startDate.getUTCFullYear(),
      input.startDate.getUTCMonth(),
      input.startDate.getUTCDate()
    )
  );
  const end = new Date(
    Date.UTC(input.endDate.getUTCFullYear(), input.endDate.getUTCMonth(), input.endDate.getUTCDate())
  );

  const rows: {
    tenantId: string;
    date: Date;
    name: string;
    type: HolidayType;
    isRecurring: boolean;
    isTentative: boolean;
  }[] = [];
  let guard = 0;
  while (cur <= end && guard < 40) {
    // 40-day cap = safety
    rows.push({ tenantId, date: new Date(cur), name, type, isRecurring: false, isTentative });
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  const { count } = await prisma.holiday.createMany({ data: rows, skipDuplicates: true });
  return count;
}

export async function deleteHoliday(tenantId: string, id: string) {
  await prisma.holiday.deleteMany({ where: { id, tenantId } });
}

/** Delete several holiday rows at once (a whole Eid block). */
export async function deleteHolidays(tenantId: string, ids: string[]) {
  if (ids.length === 0) return;
  await prisma.holiday.deleteMany({ where: { id: { in: ids }, tenantId } });
}

/** Confirm tentative holidays once the moon-sighting date is announced. */
export async function confirmHolidays(tenantId: string, ids: string[]) {
  if (ids.length === 0) return;
  await prisma.holiday.updateMany({
    where: { id: { in: ids }, tenantId },
    data: { isTentative: false },
  });
}

// ─── Applying holidays to employees (admin-decided, per employee) ──────
//
// A holiday is just a definition until applied. "Apply" gives the chosen
// employees those date(s) off by writing EmployeeOffDay rows linked back to the
// holiday. Re-applying SETS the exact employee list (added ones created, removed
// ones cleared), so the dialog is the single source of truth.

/** How many employees each holiday row is applied to → { holidayId: count }. */
export async function getAppliedCountsByHoliday(
  tenantId: string
): Promise<Record<string, number>> {
  const rows = await prisma.employeeOffDay.findMany({
    where: { tenantId, holidayId: { not: null } },
    select: { holidayId: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.holidayId) map[r.holidayId] = (map[r.holidayId] ?? 0) + 1;
  }
  return map;
}

/** Distinct employee ids that currently have any of these holiday rows applied. */
export async function getHolidayApplications(
  tenantId: string,
  holidayIds: string[]
): Promise<string[]> {
  if (holidayIds.length === 0) return [];
  const rows = await prisma.employeeOffDay.findMany({
    where: { tenantId, holidayId: { in: holidayIds } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  return rows.map((r) => r.employeeId);
}

/** Set exactly which employees have this holiday (group of date-rows) applied. */
export async function applyHolidayToEmployees(
  tenantId: string,
  holidayIds: string[],
  employeeIds: string[]
): Promise<{ applied: number; cleared: number }> {
  if (holidayIds.length === 0) throw new Error("No holiday selected");
  const holidays = await prisma.holiday.findMany({
    where: { id: { in: holidayIds }, tenantId },
    select: { id: true, date: true },
  });
  if (holidays.length === 0) throw new Error("Holiday not found");
  if (employeeIds.length) {
    await assertTenantOwns(tenantId, "employee", employeeIds);
  }

  // 1. Clear applications for employees no longer selected (only holiday-linked).
  const cleared = await prisma.employeeOffDay.deleteMany({
    where: {
      tenantId,
      holidayId: { in: holidayIds },
      ...(employeeIds.length ? { employeeId: { notIn: employeeIds } } : {}),
    },
  });

  // 2. Create off-days for the selected employees on each holiday date.
  let applied = 0;
  if (employeeIds.length) {
    const rows = holidays.flatMap((h) =>
      employeeIds.map((employeeId) => ({
        tenantId,
        employeeId,
        offDate: h.date,
        holidayId: h.id,
      }))
    );
    const res = await prisma.employeeOffDay.createMany({ data: rows, skipDuplicates: true });
    applied = res.count;
  }
  return { applied, cleared: cleared.count };
}

// ─── Working-day checker (the cross-module helper) ──────────

export type WorkingDayChecker = {
  weekendDays: number[];
  // `employeeId` is optional: when given for a custom-scheduled employee, their
  // own off dates replace the tenant weekend. Otherwise the tenant weekend applies.
  isWeekend: (d: Date | string, employeeId?: string) => boolean;
  isHoliday: (d: Date | string) => boolean;
  isWorkingDay: (d: Date | string, employeeId?: string) => boolean;
};

/**
 * Build a checker for a tenant that knows the configured weekend, the holiday
 * set, AND every employee's off-day records. Use it across attendance, leave,
 * payroll and task period maths so all agree on which days are working days —
 * per employee when an id is supplied.
 *
 * Model (admin-decided, per employee):
 *  - Holidays are a LIBRARY — they do NOT auto-affect working days. An admin
 *    "applies" a holiday to chosen employees, which writes EmployeeOffDay rows.
 *  - An off-day record makes that date non-working for that employee — whether
 *    it came from a custom weekly schedule or an applied holiday.
 *  - The tenant weekend applies to employees WITHOUT a custom schedule; for
 *    custom-scheduled employees their off-day records replace the weekend.
 *  - `isHoliday(date)` stays available (does this date have a defined holiday?)
 *    but is informational only — it is NOT used to decide working days.
 */
export async function getWorkingDayChecker(
  tenantId: string,
  years: number[] = [new Date().getUTCFullYear()]
): Promise<WorkingDayChecker> {
  const [weekendDays, holidays, customEmps, offRows] = await Promise.all([
    getWeekendDays(tenantId),
    prisma.holiday.findMany({ where: { tenantId }, select: { date: true, isRecurring: true } }),
    prisma.employee.findMany({
      where: { tenantId, usesCustomSchedule: true },
      select: { id: true },
    }),
    // ALL off-days (custom schedule + applied holidays) for every employee.
    prisma.employeeOffDay.findMany({
      where: { tenantId },
      select: { employeeId: true, offDate: true },
    }),
  ]);

  const fixedKeys = new Set<string>(); // exact YYYY-MM-DD (non-recurring)
  const recurringKeys = new Set<string>(); // MM-DD (recurring, any year)
  for (const h of holidays) {
    if (h.isRecurring) recurringKeys.add(mmdd(new Date(h.date)));
    else fixedKeys.add(dayKey(new Date(h.date)));
  }
  void years;

  const customSet = new Set(customEmps.map((e) => e.id));
  const offByEmp = new Map<string, Set<string>>();
  for (const r of offRows) {
    let set = offByEmp.get(r.employeeId);
    if (!set) offByEmp.set(r.employeeId, (set = new Set()));
    set.add(dayKey(new Date(r.offDate)));
  }

  const hasOff = (d: Date | string, employeeId?: string) =>
    !!employeeId && (offByEmp.get(employeeId)?.has(dayKey(new Date(d))) ?? false);

  // Informational: does a defined holiday fall on this date? (Not auto-applied.)
  const isHoliday = (d: Date | string) => {
    const dt = new Date(d);
    return fixedKeys.has(dayKey(dt)) || recurringKeys.has(mmdd(dt));
  };

  // Weekend for THIS employee: custom-scheduled → their off-days; else tenant weekend.
  const isWk = (d: Date | string, employeeId?: string) => {
    if (employeeId && customSet.has(employeeId)) return hasOff(d, employeeId);
    return weekendDays.includes(new Date(d).getUTCDay());
  };

  return {
    weekendDays,
    isWeekend: isWk,
    isHoliday,
    // Non-working when: the employee has an off-day that date (custom or applied
    // holiday), OR — for non-custom employees — it's a tenant weekend day.
    isWorkingDay: (d, employeeId) => {
      if (hasOff(d, employeeId)) return false;
      if (!(employeeId && customSet.has(employeeId)) && weekendDays.includes(new Date(d).getUTCDay()))
        return false;
      return true;
    },
  };
}