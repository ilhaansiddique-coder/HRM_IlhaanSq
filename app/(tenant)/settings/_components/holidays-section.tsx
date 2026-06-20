import { requireTenant } from "@/lib/auth";
import {
  listHolidays,
  getAppliedCountsByHoliday,
} from "@/lib/services/hr/holiday.service";
import { HolidaysManager, type HolidayRow } from "./holidays-manager";

export async function HolidaysSection() {
  const session = await requireTenant();
  const [holidays, appliedCounts] = await Promise.all([
    listHolidays(session.tenantId),
    getAppliedCountsByHoliday(session.tenantId),
  ]);

  const rows: HolidayRow[] = holidays.map((h) => ({
    id: h.id,
    date: h.date.toISOString(),
    name: h.name,
    type: h.type,
    isRecurring: h.isRecurring,
    isTentative: h.isTentative,
  }));

  return <HolidaysManager holidays={rows} appliedCounts={appliedCounts} />;
}