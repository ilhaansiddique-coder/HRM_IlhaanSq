import { getEmployee } from "./employee.service";
import { getEmployeeAttendanceSummary } from "./attendance.service";
import { listLeaveRequests } from "./leave.service";
import { listBreakSessions, listBreakPenalties } from "./break.service";
import { listPayslipsForEmployee, listAdvances } from "./payroll.service";
import { listDocuments } from "./documents.service";

// One "at a glance" profile for a single employee — composes every HR sub-system
// (attendance, leave, breaks, payroll, advances, documents) into one
// serializable object for the employee details dialog.

export type EmployeeProfile = {
  base: {
    id: string;
    empCode: string;
    fullName: string;
    email: string;
    phone: string | null;
    status: string;
    employmentType: string;
    department: string | null;
    position: string | null;
    manager: string | null;
    hireDate: string; // ISO
    tenureDays: number;
    baseSalary: number | null;
    currency: string;
    dob: string | null;
    gender: string | null;
    nationalId: string | null;
    address: string | null;
    emergencyContact: string | null;
    emergencyPhone: string | null;
  };
  attendance: {
    present: number;
    late: number;
    absent: number;
    holidayWorked: number;
    total: number;
    rangeStart: string;
    rangeEnd: string;
  };
  leave: {
    approvedCount: number;
    approvedDays: number;
    pendingCount: number;
    pendingDays: number;
  };
  breaks: {
    count: number;
    totalMinutes: number;
    penaltyAppliedAmount: number;
    penaltyPendingAmount: number;
  };
  payroll: {
    payslipCount: number;
    paidCount: number;
    totalPaid: number;
    lastPaidAmount: number | null;
    lastPaidMonth: string | null;
    currency: string;
  };
  advances: {
    count: number;
    totalAmount: number;
    outstanding: number; // company receivable from the employee
    recovered: number;
  };
  documents: {
    count: number;
    signed: number;
    expiringSoon: number;
    items: {
      id: string;
      name: string;
      category: string | null;
      isSigned: boolean;
      expiresAt: string | null;
      fileUrl: string | null;
    }[];
  };
};

const DAY_MS = 86_400_000;
const SOON_MS = 30 * DAY_MS;

export async function getEmployeeProfile(
  tenantId: string,
  employeeId: string
): Promise<EmployeeProfile | null> {
  const employee = await getEmployee(tenantId, employeeId);
  if (!employee) return null;

  const [attendance, leaves, sessions, penalties, payslips, advancesAll, docs] =
    await Promise.all([
      getEmployeeAttendanceSummary(tenantId, employeeId),
      listLeaveRequests(tenantId, { employeeId }),
      listBreakSessions(tenantId, { employeeId }),
      listBreakPenalties(tenantId, { employeeId }),
      listPayslipsForEmployee(tenantId, employeeId),
      listAdvances(tenantId),
      listDocuments(tenantId, { employeeId }),
    ]);

  // ─── Tenure ───
  const hire = new Date(employee.hireDate);
  const tenureDays = Math.max(
    0,
    Math.floor((Date.now() - hire.getTime()) / DAY_MS)
  );

  // ─── Leave ───
  const approved = leaves.filter((l) => l.status === "approved");
  const pending = leaves.filter((l) => l.status === "pending");

  // ─── Breaks ───
  const totalMinutes = sessions.reduce(
    (s, b) => s + (b.durationMin ?? 0),
    0
  );
  const penaltyAppliedAmount = penalties
    .filter((p) => p.status === "applied")
    .reduce((s, p) => s + Number(p.amount), 0);
  const penaltyPendingAmount = penalties
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + Number(p.amount), 0);

  // ─── Payroll ───
  const paid = payslips.filter((p) => p.paidAt);
  const totalPaid = paid.reduce((s, p) => s + Number(p.amountPaid), 0);
  const lastPaid = paid[0] ?? null; // payslips are newest-first

  // ─── Advances (company receivable) ───
  const advances = advancesAll.filter((a) => a.employeeId === employeeId);
  const totalAmount = advances.reduce((s, a) => s + Number(a.amount), 0);
  const outstanding = advances
    .filter((a) => a.status === "active")
    .reduce((s, a) => s + Number(a.outstanding), 0);
  const recovered = advances.reduce(
    (s, a) => s + (Number(a.amount) - Number(a.outstanding)),
    0
  );

  // ─── Documents ───
  const now = Date.now();
  const docItems = docs.map((d) => {
    const expiresAt =
      d.expiresAt != null ? new Date(d.expiresAt).toISOString() : null;
    return {
      id: d.id,
      name: d.name,
      category: d.category?.name ?? null,
      isSigned: d.isSigned,
      expiresAt,
      fileUrl: d.fileUrl ?? null,
    };
  });
  const expiringSoon = docItems.filter(
    (d) =>
      d.expiresAt != null &&
      new Date(d.expiresAt).getTime() - now <= SOON_MS &&
      new Date(d.expiresAt).getTime() >= now
  ).length;

  return {
    base: {
      id: employee.id,
      empCode: employee.empCode,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone ?? null,
      status: employee.status,
      employmentType: employee.employmentType,
      department: employee.department?.name ?? null,
      position: employee.position?.title ?? null,
      manager: employee.manager?.fullName ?? null,
      hireDate: hire.toISOString(),
      tenureDays,
      baseSalary: employee.baseSalary != null ? Number(employee.baseSalary) : null,
      currency: employee.currency ?? "BDT",
      dob: employee.dob ? new Date(employee.dob).toISOString() : null,
      gender: employee.gender ?? null,
      nationalId: employee.nationalId ?? null,
      address: employee.address ?? null,
      emergencyContact: employee.emergencyContact ?? null,
      emergencyPhone: employee.emergencyPhone ?? null,
    },
    attendance: {
      present: attendance.counts.present,
      late: attendance.counts.late,
      absent: attendance.counts.absent,
      holidayWorked: attendance.counts.holidayWorked,
      total: attendance.counts.total,
      rangeStart: attendance.rangeStart,
      rangeEnd: attendance.rangeEnd,
    },
    leave: {
      approvedCount: approved.length,
      approvedDays: approved.reduce((s, l) => s + (l.days ?? 0), 0),
      pendingCount: pending.length,
      pendingDays: pending.reduce((s, l) => s + (l.days ?? 0), 0),
    },
    breaks: {
      count: sessions.length,
      totalMinutes,
      penaltyAppliedAmount,
      penaltyPendingAmount,
    },
    payroll: {
      payslipCount: payslips.length,
      paidCount: paid.length,
      totalPaid,
      lastPaidAmount: lastPaid ? Number(lastPaid.amountPaid) : null,
      lastPaidMonth: lastPaid ? lastPaid.month : null,
      currency: employee.currency ?? "BDT",
    },
    advances: {
      count: advances.length,
      totalAmount,
      outstanding,
      recovered,
    },
    documents: {
      count: docItems.length,
      signed: docItems.filter((d) => d.isSigned).length,
      expiringSoon,
      items: docItems,
    },
  };
}
