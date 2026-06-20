import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import {
  getDashboardAnalytics,
  getPlatformCounters,
} from "@/lib/services/dashboard-analytics.service";
import { getRecentNotifications } from "@/lib/services/notifications.service";
import { getEmployeeStats, listEmployees } from "@/lib/services/hr/employee.service";
import { listDepartments, listPositions } from "@/lib/services/hr/department.service";
import { AddEmployeeDialog } from "./employees/_components/add-employee-dialog";
import { HrOverview } from "./_components/hr-overview";
import { MobileDashboardHeader } from "./_components/mobile-overview-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Building2, Inbox, Users, UserCog } from "lucide-react";
import { resolveDateBounds } from "@/lib/date-range";

// Merged Overview — this is the tenant home (formerly the separate /dashboard).
// Top: role-aware analytics (super admins see platform counters; everyone else
// sees the HR analytics dashboard). Below: the HR module map + workforce status
// that used to be unique to /hr.
export default async function HROverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();
  const scope = session.isSuperAdmin ? null : session.tenantId;

  // Top-bar date filter. The Overview's KPIs are live snapshots; only the
  // "Recent Hires" list honors the range (all-time default = recent hires).
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");

  const [
    analytics,
    platform,
    notifications,
    empStats,
    departments,
    positions,
    activeEmployees,
  ] = await Promise.all([
    getDashboardAnalytics(scope, { from: start, to: end }),
    session.isSuperAdmin ? getPlatformCounters() : Promise.resolve(null),
    // The mobile header renders its own NotificationBell (the desktop TopBar is
    // hidden on mobile) — fetch the same set the TopBar uses for accurate counts.
    getRecentNotifications(scope, session.userId, 12),
    getEmployeeStats(session.tenantId),
    listDepartments(session.tenantId),
    listPositions(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <>
      {/* Add Employee opens from the "+" button in the top bar (left of the
          notification bell). Portals into the TopBar; nothing inline. */}
      <AddEmployeeDialog
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
        managers={activeEmployees.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          empCode: e.empCode,
        }))}
      />

      {/* Mobile-only header. Kept OUTSIDE the spacing wrapper so on desktop
          (where it's hidden) it adds no leading gap above the cards — the page
          body's top spacing then equals the left/right padding from <main>. */}
      <div className="mb-4 lg:hidden">
        <MobileDashboardHeader notifications={notifications} />
      </div>

      {/* Page body */}
      <div className="space-y-6">
      {/* Analytics on top — role-aware */}
      {platform ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <PlatformCard
            icon={<Building2 className="h-4 w-4" />}
            label="Total Tenants"
            value={platform.totalTenants}
          />
          <PlatformCard
            icon={<Inbox className="h-4 w-4" />}
            label="Pending Requests"
            value={platform.pendingRequests}
          />
          <PlatformCard
            icon={<Users className="h-4 w-4" />}
            label="Total Users"
            value={platform.totalUsers}
          />
        </div>
      ) : (
        <HrOverview data={analytics} />
      )}

      {/* Workforce status breakdown */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Workforce Status
          </CardTitle>
          <CardDescription>Breakdown of employees by status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <StatusRow label="Active" count={empStats.active} variant="default" />
          <StatusRow label="On Leave" count={empStats.onLeave} variant="secondary" />
          <StatusRow label="Terminated" count={empStats.terminated} variant="outline" />
        </CardContent>
      </Card>

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
            <ModuleLink href="/hr/employees" title="Employee Lifecycle" desc="Hire-to-retire records" />
            <ModuleLink href="/hr/departments" title="Departments" desc="Org structure & hierarchy" />
            <ModuleLink href="/hr/positions" title="Positions" desc="Job catalog & grades" />
            <ModuleLink href="/hr/attendance" title="Attendance" desc="Daily check-in/out tracking" />
            <ModuleLink href="/hr/leave" title="Leave Management" desc="Multi-policy leave engine" />
            <ModuleLink href="/hr/payroll" title="Payroll Engine" desc="Multi-currency, statutory" />
            <ModuleLink href="/hr/performance" title="Performance" desc="OKR (Objectives & Key Results) / KPI (Key Performance Indicator) / 360 reviews" />
            <ModuleLink href="/hr/recruitment" title="Recruitment (ATS)" desc="Pipeline, JD, offers" />
            <ModuleLink href="/hr/learning" title="Learning (LMS)" desc="Courses & certifications" />
            <ModuleLink href="/hr/documents" title="Documents" desc="e-Sign, contracts, DMS" />
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  );
}

function PlatformCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <MetricCard icon={icon} label={label} value={value.toLocaleString()} tone="primary" />
  );
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
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="rounded-lg border border-border/60 bg-background/40 p-3 hover:border-primary/40 hover:bg-background/60 transition-colors h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
          <Badge variant="default" className="shrink-0 text-[10px] px-1.5 h-5">
            Live
          </Badge>
        </div>
      </div>
    </Link>
  );
}
