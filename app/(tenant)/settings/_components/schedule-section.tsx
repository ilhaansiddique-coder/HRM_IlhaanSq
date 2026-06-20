import { requireTenant } from "@/lib/auth";
import { getScheduleMonth } from "@/lib/services/hr/schedule.service";
import { ScheduleGrid } from "./schedule-grid";

// Per-employee off-day grid + lunch windows. Server component: loads the current
// month and hands it to the client grid, which manages month navigation + edits.
export async function ScheduleSection() {
  const session = await requireTenant();
  const now = new Date();
  const initial = await getScheduleMonth(
    session.tenantId,
    now.getUTCFullYear(),
    now.getUTCMonth() + 1
  );
  return <ScheduleGrid initial={initial} />;
}