import { prisma } from "../db";
import { getEmployeeStats } from "./hr/employee.service";
import {
  getAttendanceStats,
  getAttendanceRosterToday,
  type AttendanceRoster,
} from "./hr/attendance.service";
import { getPayrollStats } from "./hr/payroll.service";
import { getApprovalStats } from "./approvals.service";
import { getRecruitmentStats } from "./hr/recruitment.service";
import { listLeaveRequests } from "./hr/leave.service";

// HR overview dashboard. Tenant-scoped only — HR data always belongs to a
// single workspace. Super admins (no tenant) get platform counters instead
// (see getPlatformCounters), surfaced separately by the dashboard page.

type Scope = string | null;

export type HrDashboard = {
  kpis: {
    totalEmployees: number;
    activeEmployees: number;
    presentToday: number;
    onLeaveToday: number;
    pendingApprovals: number;
    pendingLeave: number;
    openJobs: number;
  };
  attendanceToday: {
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
  };
  attendanceRoster: AttendanceRoster;
  headcountByDept: { name: string; count: number }[];
  pendingLeaveRequests: {
    id: string;
    employeeName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
  }[];
  payroll: {
    lastRunName: string | null;
    lastRunAt: string | null;
    activeSalaries: number;
    activeAdvances: number;
    runCount: number;
  };
  recruitment: {
    openJobs: number;
    totalApplicants: number;
    inPipeline: number;
    hired: number;
  };
  recentHires: {
    id: string;
    fullName: string;
    empCode: string;
    department: string | null;
    hireDate: string;
  }[];
};

// Empty shape — returned for the (rare) tenant-less render so the page
// can stay type-safe without null-guarding every field.
const EMPTY: HrDashboard = {
  kpis: {
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingApprovals: 0,
    pendingLeave: 0,
    openJobs: 0,
  },
  attendanceToday: { present: 0, late: 0, absent: 0, attendanceRate: 0 },
  attendanceRoster: { present: [], late: [], onLeave: [], absent: [] },
  headcountByDept: [],
  pendingLeaveRequests: [],
  payroll: {
    lastRunName: null,
    lastRunAt: null,
    activeSalaries: 0,
    activeAdvances: 0,
    runCount: 0,
  },
  recruitment: { openJobs: 0, totalApplicants: 0, inPipeline: 0, hired: 0 },
  recentHires: [],
};

export async function getDashboardAnalytics(
  tenantId: Scope,
  // Optional top-bar date filter. The Overview's KPIs are live operational
  // snapshots ("present today", pending approvals, headcount) and ignore it by
  // design; only the date-bounded "Recent Hires" list honors the range.
  range?: { from?: Date | null; to?: Date | null }
): Promise<HrDashboard> {
  if (!tenantId) return EMPTY;

  const hireDate =
    range?.from || range?.to
      ? { ...(range?.from && { gte: range.from }), ...(range?.to && { lte: range.to }) }
      : undefined;

  const [
    employee,
    attendance,
    attendanceRoster,
    payroll,
    approvals,
    recruitment,
    pendingLeave,
    departments,
    recentHires,
  ] = await Promise.all([
    getEmployeeStats(tenantId),
    getAttendanceStats(tenantId),
    getAttendanceRosterToday(tenantId),
    getPayrollStats(tenantId),
    getApprovalStats(tenantId),
    getRecruitmentStats(tenantId),
    listLeaveRequests(tenantId, { status: "pending" }),
    prisma.department.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        name: true,
        _count: { select: { employees: true } },
      },
    }),
    prisma.employee.findMany({
      where: { tenantId, status: "active", ...(hireDate && { hireDate }) },
      orderBy: { hireDate: "desc" },
      take: 6,
      select: {
        id: true,
        fullName: true,
        empCode: true,
        hireDate: true,
        department: { select: { name: true } },
      },
    }),
  ]);

  return {
    kpis: {
      totalEmployees: employee.total,
      activeEmployees: employee.active,
      presentToday: attendance.present + attendance.late,
      onLeaveToday: employee.onLeave,
      pendingApprovals: approvals.pending,
      pendingLeave: pendingLeave.length,
      openJobs: recruitment.openJobs,
    },
    attendanceToday: {
      present: attendance.present,
      late: attendance.late,
      absent: attendance.absent,
      attendanceRate: attendance.attendanceRate,
    },
    attendanceRoster,
    headcountByDept: departments
      .map((d) => ({ name: d.name, count: d._count.employees }))
      .filter((d) => d.count > 0),
    pendingLeaveRequests: pendingLeave.slice(0, 6).map((r) => ({
      id: r.id,
      employeeName: r.employee?.fullName ?? "—",
      leaveTypeName: r.leaveType?.name ?? "Leave",
      startDate: r.startDate,
      endDate: r.endDate,
    })),
    payroll: {
      lastRunName: payroll.lastRun?.period?.name ?? null,
      lastRunAt: payroll.lastRun?.completedAt
        ? payroll.lastRun.completedAt.toISOString()
        : null,
      activeSalaries: payroll.activeSalaryCount,
      activeAdvances: payroll.activeAdvanceCount,
      runCount: payroll.runCount,
    },
    recruitment: {
      openJobs: recruitment.openJobs,
      totalApplicants: recruitment.totalApplicants,
      inPipeline: recruitment.inPipeline,
      hired: recruitment.hired,
    },
    recentHires: recentHires.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      empCode: e.empCode,
      department: e.department?.name ?? null,
      hireDate: e.hireDate.toISOString(),
    })),
  };
}

// ─── Platform-wide counters (super admin only) ──────────────
// Tenants + pending tenant requests + total users. DemoRequest is the
// backing store for the tenant-onboarding queue (kept feature).

export type PlatformCounters = {
  totalTenants: number;
  pendingRequests: number;
  totalUsers: number;
};

export async function getPlatformCounters(): Promise<PlatformCounters> {
  const [totalTenants, pendingRequests, totalUsers] = await Promise.all([
    prisma.tenant.count(),
    prisma.demoRequest.count({ where: { status: "pending" } }),
    prisma.user.count(),
  ]);
  return { totalTenants, pendingRequests, totalUsers };
}
