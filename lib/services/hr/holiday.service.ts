import { prisma } from "../../db";
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
  input: { date: Date; name: string; type?: HolidayType; isRecurring?: boolean }
) {
  if (!input.name?.trim()) throw new Error("Holiday name is required");
  return prisma.holiday.create({
    data: {
      tenantId,
      date: input.date,
      name: input.name.trim(),
      type: input.type ?? "public",
      isRecurring: input.isRecurring ?? false,
    },
  });
}

export async function deleteHoliday(tenantId: string, id: string) {
  await prisma.holiday.deleteMany({ where: { id, tenantId } });
}

// ─── Working-day checker (the cross-module helper) ──────────

export type WorkingDayChecker = {
  weekendDays: number[];
  isWeekend: (d: Date | string) => boolean;
  isHoliday: (d: Date | string) => boolean;
  isWorkingDay: (d: Date | string) => boolean;
};

/**
 * Build a checker for a tenant that knows the configured weekend + the holiday
 * set. Use it across attendance, leave, payroll and task period maths so all
 * four agree on which days are working days.
 */
export async function getWorkingDayChecker(
  tenantId: string,
  years: number[] = [new Date().getUTCFullYear()]
): Promise<WorkingDayChecker> {
  const [weekendDays, holidays] = await Promise.all([
    getWeekendDays(tenantId),
    prisma.holiday.findMany({ where: { tenantId }, select: { date: true, isRecurring: true } }),
  ]);

  const fixedKeys = new Set<string>(); // exact YYYY-MM-DD (non-recurring)
  const recurringKeys = new Set<string>(); // MM-DD (recurring, any year)
  for (const h of holidays) {
    if (h.isRecurring) recurringKeys.add(mmdd(new Date(h.date)));
    else fixedKeys.add(dayKey(new Date(h.date)));
  }
  void years;

  const isHoliday = (d: Date | string) => {
    const dt = new Date(d);
    return fixedKeys.has(dayKey(dt)) || recurringKeys.has(mmdd(dt));
  };
  const isWk = (d: Date | string) => weekendDays.includes(new Date(d).getUTCDay());

  return {
    weekendDays,
    isWeekend: isWk,
    isHoliday,
    isWorkingDay: (d) => !isWk(d) && !isHoliday(d),
  };
}

// ─── Bangladesh starter seed ────────────────────────────────

// Fixed-date national holidays that recur every year. Moon-sighting holidays
// (Eid, Shab-e-Barat, Ashura, Eid-e-Miladunnabi) are NOT seeded — they move
// each year and must be entered per year by the admin from the gazette.
const BD_FIXED = [
  { mm: 2, dd: 21, name: "Language Martyrs' Day (Shaheed Day)" },
  { mm: 3, dd: 26, name: "Independence Day" },
  { mm: 4, dd: 14, name: "Pohela Boishakh (Bengali New Year)" },
  { mm: 5, dd: 1, name: "May Day" },
  { mm: 8, dd: 15, name: "National Mourning Day" },
  { mm: 12, dd: 16, name: "Victory Day" },
  { mm: 12, dd: 25, name: "Christmas Day (Boro Din)" },
];

/** Seed the recurring Bangladesh national holidays (idempotent). */
export async function seedBangladeshHolidays(tenantId: string) {
  const year = new Date().getUTCFullYear();
  const rows = BD_FIXED.map((h) => ({
    tenantId,
    date: new Date(Date.UTC(year, h.mm - 1, h.dd)),
    name: h.name,
    type: "public" as HolidayType,
    isRecurring: true,
  }));
  // Skip rows that already exist (unique on tenant+date+name).
  await prisma.holiday.createMany({ data: rows, skipDuplicates: true });
}