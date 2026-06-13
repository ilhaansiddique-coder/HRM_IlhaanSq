import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  CalendarClock,
  CalendarDays,
  ShieldCheck,
  Wallet,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import type { HrDashboard } from "@/lib/services/dashboard-analytics.service";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Kpi({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="border-border/70 bg-card/80 transition-colors hover:bg-muted/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">
            {value.toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function HrOverview({ data }: { data: HrDashboard }) {
  const { kpis, attendanceToday, headcountByDept, pendingLeaveRequests } =
    data;
  const maxDept = Math.max(1, ...headcountByDept.map((d) => d.count));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Total Employees"
          value={kpis.totalEmployees}
          href="/hr/employees"
        />
        <Kpi
          icon={<UserCheck className="h-4 w-4" />}
          label="Present Today"
          value={kpis.presentToday}
          href="/hr/attendance"
        />
        <Kpi
          icon={<CalendarDays className="h-4 w-4" />}
          label="On Leave"
          value={kpis.onLeaveToday}
          href="/hr/leave"
        />
        <Kpi
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Pending Approvals"
          value={kpis.pendingApprovals}
          href="/admin"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Attendance today */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-primary" />
              Attendance Today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Present" value={attendanceToday.present} tone="success" />
              <Stat label="Late" value={attendanceToday.late} tone="warning" />
              <Stat label="Absent" value={attendanceToday.absent} tone="destructive" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Attendance rate</span>
                <span className="font-medium text-foreground">
                  {attendanceToday.attendanceRate}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${attendanceToday.attendanceRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Headcount by department */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Headcount by Department
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {headcountByDept.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No departments yet.
              </p>
            ) : (
              headcountByDept.map((d) => (
                <div key={d.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{d.name}</span>
                    <span className="text-muted-foreground">{d.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${(d.count / maxDept) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pending leave requests */}
        <Card className="border-border/70 bg-card/80 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary" />
              Pending Leave Requests
            </CardTitle>
            <Link
              href="/hr/leave"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingLeaveRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No pending leave requests.
              </p>
            ) : (
              pendingLeaveRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.leaveTypeName} · {fmtDate(r.startDate)} –{" "}
                      {fmtDate(r.endDate)}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    pending
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Payroll + recruitment snapshot */}
        <div className="space-y-4">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-primary" />
                Payroll
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Last run" value={data.payroll.lastRunName ?? "—"} />
              <Row
                label="Active salaries"
                value={data.payroll.activeSalaries.toLocaleString()}
              />
              <Row
                label="Active advances"
                value={data.payroll.activeAdvances.toLocaleString()}
              />
              <Row
                label="Total runs"
                value={data.payroll.runCount.toLocaleString()}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-5 w-5 text-primary" />
                Recruitment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label="Open jobs"
                value={data.recruitment.openJobs.toLocaleString()}
              />
              <Row
                label="Applicants"
                value={data.recruitment.totalApplicants.toLocaleString()}
              />
              <Row
                label="In pipeline"
                value={data.recruitment.inPipeline.toLocaleString()}
              />
              <Row
                label="Hired"
                value={data.recruitment.hired.toLocaleString()}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent hires */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-primary" />
            Recent Hires
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentHires.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No employees yet.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.recentHires.map((e) => (
                <Link
                  key={e.id}
                  href={`/hr/employees/${e.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {e.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.empCode}
                      {e.department ? ` · ${e.department}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(e.hireDate)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
