import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard, type StatTone } from "@/components/ui/stat-card";
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
import { AttendanceRosterTabs } from "./attendance-roster-tabs";

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
  subtitle,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  href: string;
  subtitle?: string;
  tone?: StatTone;
}) {
  return (
    <StatCard
      icon={icon}
      label={label}
      value={value.toLocaleString()}
      href={href}
      subtitle={subtitle}
      tone={tone}
    />
  );
}

export function HrOverview({ data }: { data: HrDashboard }) {
  const {
    kpis,
    attendanceToday,
    attendanceRoster,
    headcountByDept,
    pendingLeaveRequests,
  } = data;
  const { present, late, onLeave, absent } = attendanceRoster;
  const rosterTotal =
    present.length + late.length + onLeave.length + absent.length;
  const maxDept = Math.max(1, ...headcountByDept.map((d) => d.count));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Users />}
          label="Total Employees"
          value={kpis.totalEmployees}
          href="/hr/employees"
          subtitle="Active headcount"
          tone="primary"
        />
        <Kpi
          icon={<UserCheck />}
          label="Present Today"
          value={kpis.presentToday}
          href="/hr/attendance"
          subtitle="Checked in today"
          tone="success"
        />
        <Kpi
          icon={<CalendarDays />}
          label="On Leave"
          value={kpis.onLeaveToday}
          href="/hr/leave"
          subtitle="Away today"
          tone="info"
        />
        <Kpi
          icon={<ShieldCheck />}
          label="Pending Approvals"
          value={kpis.pendingApprovals}
          href="/admin"
          subtitle="Awaiting action"
          tone="warning"
        />
      </div>

      {/* Attendance Today (70%) + Headcount by Department (30%) */}
      <div className="grid gap-4 lg:grid-cols-10">
        {/* Attendance today — 70% */}
        <Card className="border-border/70 bg-card/80 lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-primary" />
              Attendance Today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stat tiles — present / late / absent / on leave */}
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <Stat label="Present" value={present.length} tone="success" />
              <Stat label="Late" value={late.length} tone="warning" />
              <Stat label="Absent" value={absent.length} tone="destructive" />
              <Stat label="On Leave" value={onLeave.length} tone="info" />
            </div>

            {/* Attendance rate */}
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

            {/* Per-status employee roster */}
            {rosterTotal === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active employees yet.
              </p>
            ) : (
              <AttendanceRosterTabs
                present={present}
                late={late}
                onLeave={onLeave}
                absent={absent}
              />
            )}
          </CardContent>
        </Card>

        {/* Headcount by department — 30% */}
        <Card className="border-border/70 bg-card/80 lg:col-span-3">
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

type Tone = "success" | "warning" | "destructive" | "info";

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-primary",
};


function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-3">
      <p className={`text-2xl font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
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
