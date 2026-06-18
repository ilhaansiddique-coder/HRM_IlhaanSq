import { requireTenant } from "@/lib/auth";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  getMonthlyReport,
  resolveScope,
  type MonthlyReportRow,
} from "@/lib/services/hr/task.service";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function tone(v: number) {
  if (v >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className={tone(value)}>{value}%</span>;
}

export default async function TaskReportsPage() {
  const session = await requireTenant();
  const { isAdmin, isManager, scopeIds } = await resolveScope(
    session.tenantId,
    session.userId,
    session.role
  );

  // Admins → all active employees; managers → self + direct reports; else → me.
  const list = await listEmployees(session.tenantId, { status: "active" });
  const scoped = scopeIds ? new Set(scopeIds) : null;
  const employees = (scoped ? list.filter((e) => scoped.has(e.id)) : list).map((e) => ({
    id: e.id,
    fullName: e.fullName,
    empCode: e.empCode,
  }));

  const now = new Date();
  const rows: MonthlyReportRow[] = employees.length
    ? await getMonthlyReport(session.tenantId, employees, now)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold">
          Productivity report — {MONTHS[now.getMonth()]} {now.getFullYear()}
          {isAdmin ? "" : isManager ? " (my team)" : " (mine)"}
        </h2>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">Employee</th>
              <th className="px-3 py-2.5 text-center font-medium">Today</th>
              <th className="px-3 py-2.5 text-center font-medium">This week</th>
              <th className="px-3 py-2.5 text-center font-medium">This month</th>
              <th className="px-3 py-2.5 text-center font-medium">On-time</th>
              <th className="px-3 py-2.5 text-center font-medium">Done/Assigned</th>
              <th className="px-3 py-2.5 text-center font-medium">Active days</th>
              <th className="px-3 py-2.5 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No data yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.employeeId} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{r.fullName}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.empCode}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center"><Pct value={r.todayRate} /></td>
                  <td className="px-3 py-2.5 text-center"><Pct value={r.weekRate} /></td>
                  <td className="px-3 py-2.5 text-center"><Pct value={r.monthRate} /></td>
                  <td className="px-3 py-2.5 text-center"><Pct value={r.onTimeRatio} /></td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    {r.completed} / {r.assigned}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">{r.activeDays}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-base font-bold ${tone(r.score)}`}>{r.score}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Score = task completion (0.40) + active days (0.15) + on-time (0.15), re-normalised to
        0–100. Every figure traces back to recorded activity.
      </p>
    </div>
  );
}