import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getEmployeeAttendanceSummary,
  getAttendanceDayKey,
} from "@/lib/services/hr/attendance.service";
import { getActiveBreak } from "@/lib/services/hr/break.service";
import { listPayslipsForEmployee } from "@/lib/services/hr/payroll.service";
import { getEmployeePerformance } from "@/lib/services/hr/task.service";
import { getWorkingDayChecker } from "@/lib/services/hr/holiday.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  Coffee,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCircle,
  Wallet,
  Gauge,
  ArrowUpRight,
} from "lucide-react";
import { SelfCheckInOut } from "../_components/self-check-in-out";

function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function scoreTone(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

export default async function EmployeeHomePage() {
  const session = await requireTenant();

  const employee = await prisma.employee.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
    include: {
      department: { select: { name: true } },
      position: { select: { title: true } },
    },
  });

  if (!employee) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <UserCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-semibold">No employee profile linked</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account isn’t linked to an employee record yet. Please contact
          your administrator.
        </p>
      </div>
    );
  }

  const { from, to } = monthBounds();
  const [summary, activeBreak, payslips, wd] = await Promise.all([
    getEmployeeAttendanceSummary(session.tenantId, employee.id),
    getActiveBreak(session.tenantId, employee.id),
    listPayslipsForEmployee(session.tenantId, employee.id),
    getWorkingDayChecker(session.tenantId),
  ]);
  const perf = await getEmployeePerformance(
    session.tenantId,
    employee.id,
    from,
    to,
    wd.isWorkingDay
  );

  const todayKey = await getAttendanceDayKey(session.tenantId);
  const todayRec =
    summary.records.find(
      (r) => new Date(r.date).getTime() === todayKey.getTime()
    ) ?? null;
  const latest = payslips[0];

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card className="border-border/70 bg-card/80">
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold">
            {employee.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight">
              {employee.fullName}
            </p>
            <p className="text-sm text-muted-foreground">
              {employee.position?.title ?? "—"}
              {employee.department?.name
                ? ` · ${employee.department.name}`
                : ""}{" "}
              · <span className="font-mono">{employee.empCode}</span>
            </p>
          </div>
          <Badge
            variant={employee.status === "active" ? "default" : "secondary"}
            className="ml-auto capitalize"
          >
            {employee.status.replace("_", " ")}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Check-in / out */}
        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Today
            </CardTitle>
            <CardDescription>Office starts 09:00</CardDescription>
          </CardHeader>
          <CardContent>
            <SelfCheckInOut
              employeeId={employee.id}
              today={
                todayRec
                  ? {
                      status: todayRec.status,
                      checkIn: todayRec.checkIn,
                      checkOut: todayRec.checkOut,
                    }
                  : null
              }
            />
          </CardContent>
        </Card>

        {/* Attendance calendar + counts */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              My attendance
            </CardTitle>
            <CardDescription>Last 3 months</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini icon={<CheckCircle2 className="h-4 w-4" />} label="Present" value={summary.counts.present} tone="success" />
              <Mini icon={<Clock className="h-4 w-4" />} label="Late" value={summary.counts.late} tone="warning" />
              <Mini icon={<AlertCircle className="h-4 w-4" />} label="Absent" value={summary.counts.absent} tone="destructive" />
              <Mini icon={<Coffee className="h-4 w-4" />} label="Holiday worked" value={summary.counts.holidayWorked} tone="primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My performance this month — auto-computed from completed tasks */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              My performance
            </CardTitle>
            <CardDescription>
              This month · updates automatically as you complete tasks
            </CardDescription>
          </div>
          <Link href="/hr/tasks">
            <Button variant="outline" size="sm" className="gap-1">
              My tasks
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 border-border/60">
              <span className={`text-2xl font-bold leading-none ${scoreTone(perf.score)}`}>
                {perf.score}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                score
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${perf.taskCompletionRate}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {perf.completed}/{perf.assigned} due tasks done ·{" "}
                {perf.taskCompletionRate}% completion
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Completed" value={perf.throughput} tone="success" />
            <Mini label="On time" value={`${perf.onTimeRatio}%`} tone="primary" />
            <Mini label="Active days" value={perf.activeDays} />
            <Mini label="Due this month" value={perf.assigned} />
          </div>
        </CardContent>
      </Card>

      {/* Latest payslip + link */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Salary
            </CardTitle>
            <CardDescription>
              {latest
                ? `Latest: ${latest.month}`
                : "No payslips yet"}
            </CardDescription>
          </div>
          <Link href="/employee/payslips">
            <Button variant="outline" size="sm" className="gap-1">
              All payslips
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        {latest && (
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Mini label="Net pay" value={`${latest.currency} ${latest.payable.toLocaleString()}`} tone="primary" />
            <Mini label="Gross" value={`${latest.currency} ${latest.gross.toLocaleString()}`} />
            <Mini label="Extra duty" value={`${latest.extraDutyDays} d`} tone="success" />
            <Mini label="Status" value={latest.paidAt ? "Paid" : "Pending"} tone={latest.paidAt ? "success" : "warning"} />
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/hr/attendance">
          <Button variant="outline" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Attendance
          </Button>
        </Link>
        <Link href="/hr/break">
          <Button variant="outline" className="gap-2">
            <Coffee className="h-4 w-4" />
            Break time
            {activeBreak ? (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                on break
              </Badge>
            ) : null}
          </Button>
        </Link>
        <Link href="/employee/payslips">
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            Payslips
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Mini({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const c =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : tone === "primary"
            ? "text-primary"
            : "";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${c}`}>{value}</p>
    </div>
  );
}
