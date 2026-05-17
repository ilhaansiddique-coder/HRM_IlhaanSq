import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getEmployeeStats } from "@/lib/services/hr/employee.service";
import { getAttendanceStats } from "@/lib/services/hr/attendance.service";
import { listLeaveRequests } from "@/lib/services/hr/leave.service";
import { listDepartments } from "@/lib/services/hr/department.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CalendarClock,
  CalendarDays,
  Building2,
  UserCog,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default async function HRDashboardPage() {
  const session = await requireTenant();

  const [empStats, attStats, pendingLeave, departments] = await Promise.all([
    getEmployeeStats(session.tenantId),
    getAttendanceStats(session.tenantId),
    listLeaveRequests(session.tenantId, { status: "pending" }),
    listDepartments(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end">
        <Link href="/hr/employees/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </Link>
      </div>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          title="Total Employees"
          value={empStats.total}
          hint={`${empStats.active} active`}
          href="/hr/employees"
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          title="Today's Attendance"
          value={attStats.present}
          hint={`${attStats.attendanceRate}% rate`}
          variant="success"
          href="/hr/attendance"
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          title="Pending Leave"
          value={pendingLeave.length}
          hint="Awaiting approval"
          variant={pendingLeave.length > 0 ? "warning" : "default"}
          href="/hr/leave"
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          title="Departments"
          value={departments.length}
          hint="Active units"
          href="/hr/departments"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Workforce Status
            </CardTitle>
            <CardDescription>Breakdown of employees by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Active" count={empStats.active} variant="default" />
            <StatusRow label="On Leave" count={empStats.onLeave} variant="secondary" />
            <StatusRow label="Terminated" count={empStats.terminated} variant="outline" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Pending Leave Requests
              </CardTitle>
              <CardDescription>
                {pendingLeave.length === 0 ? "All caught up" : `${pendingLeave.length} awaiting your review`}
              </CardDescription>
            </div>
            <Link href="/hr/leave">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingLeave.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              pendingLeave.slice(0, 5).map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {req.employee.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.leaveType.name} · {req.days} day{req.days !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    style={{ borderColor: req.leaveType.color, color: req.leaveType.color }}
                    className="text-xs shrink-0"
                  >
                    {req.leaveType.code}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links — module map */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            HR Modules
          </CardTitle>
          <CardDescription>All modules are live</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleLink href="/hr/employees" title="Employee Lifecycle" desc="Hire-to-retire records" status="live" />
            <ModuleLink href="/hr/departments" title="Departments" desc="Org structure & hierarchy" status="live" />
            <ModuleLink href="/hr/positions" title="Positions" desc="Job catalog & grades" status="live" />
            <ModuleLink href="/hr/attendance" title="Attendance" desc="Daily check-in/out tracking" status="live" />
            <ModuleLink href="/hr/leave" title="Leave Management" desc="Multi-policy leave engine" status="live" />
            <ModuleLink href="/hr/payroll" title="Payroll Engine" desc="Multi-currency, statutory" status="live" />
            <ModuleLink href="/hr/performance" title="Performance" desc="OKR / KPI / 360 reviews" status="live" />
            <ModuleLink href="/hr/recruitment" title="Recruitment (ATS)" desc="Pipeline, JD, offers" status="live" />
            <ModuleLink href="/hr/learning" title="Learning (LMS)" desc="Courses & certifications" status="live" />
            <ModuleLink href="/hr/documents" title="Documents" desc="e-Sign, contracts, DMS" status="live" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  hint,
  href,
  variant = "default",
}: {
  icon: ReactNode;
  title: string;
  value: number | string;
  hint?: string;
  href?: string;
  variant?: "default" | "success" | "warning";
}) {
  const iconBg =
    variant === "success"
      ? "bg-success/10 text-success"
      : variant === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";

  const inner = (
    <Card className={`border-border/70 bg-card/80 ${href ? "hover:shadow-sm transition-shadow cursor-pointer" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatusRow({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "default" | "secondary" | "outline";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <Badge variant={variant}>{count}</Badge>
    </div>
  );
}

function ModuleLink({
  href,
  title,
  desc,
  status,
}: {
  href: string;
  title: string;
  desc: string;
  status: "live" | "soon";
}) {
  return (
    <Link href={href} className="block">
      <div className="rounded-lg border border-border/60 bg-background/40 p-3 hover:border-primary/40 hover:bg-background/60 transition-colors h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
          {status === "live" ? (
            <Badge variant="default" className="shrink-0 text-[10px] px-1.5 h-5">Live</Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 h-5">Soon</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
