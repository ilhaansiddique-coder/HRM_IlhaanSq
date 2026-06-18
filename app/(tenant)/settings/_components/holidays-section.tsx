import { requireTenant } from "@/lib/auth";
import { listHolidays, getWeekendDays } from "@/lib/services/hr/holiday.service";
import { HolidaysManager, type HolidayRow } from "./holidays-manager";

export async function HolidaysSection() {
  const session = await requireTenant();
  const [holidays, weekendDays] = await Promise.all([
    listHolidays(session.tenantId),
    getWeekendDays(session.tenantId),
  ]);

  const rows: HolidayRow[] = holidays.map((h) => ({
    id: h.id,
    date: h.date.toISOString(),
    name: h.name,
    type: h.type,
    isRecurring: h.isRecurring,
  }));

  return <HolidaysManager holidays={rows} weekendDays={weekendDays} />;
}