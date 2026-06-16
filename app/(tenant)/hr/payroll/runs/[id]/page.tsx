import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getPayrollRun,
  isTenantAdmin,
  listPayrollColumns,
  computeCustomColumnValue,
  describeCustomColumn,
  isManualColumn,
  parseFormula,
  PAYROLL_BASE_FIELDS,
  getEffectiveBaseColumns,
  getPayslipCustomValues,
} from "@/lib/services/hr/payroll.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { refreshRunAdvancesFormAction } from "../../../actions-phase2";
import { SalarySheet, type Slip, type CustomCol } from "./_components/salary-sheet";
import { SalarySheetFullView } from "./_components/salary-sheet-full-view";
import { ColumnManager, type ManagerCol } from "./_components/column-manager";
import {
  BaseColumnManager,
  type BaseCol,
} from "./_components/base-column-manager";
import { AdvanceLiveRefresh } from "../../_components/advance-live-refresh";

// Accepts plain numbers/strings and Prisma Decimal objects.
const fmt = (n: number | string | { toString(): string }) =>
  Number(typeof n === "object" ? n.toString() : n).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Guard against non-UUID segments (e.g. the retired "/runs/new" path now
  // falling through to this dynamic route) — a non-UUID id would crash the
  // Prisma UUID lookup, so treat it as not found.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) notFound();
  const session = await requireTenant();
  const run = await getPayrollRun(session.tenantId, id);
  if (!run) notFound();

  const slips = run.payslips;
  // Resolve the role live from the DB membership (the login JWT can be stale),
  // and allow platform super-admins too.
  const canEdit =
    session.isSuperAdmin || (await isTenantAdmin(session.tenantId, session.userId));

  const columnDefs = await listPayrollColumns(session.tenantId);
  // Manual columns: per-employee value from the DB (not formula-computed).
  const manualVals = await getPayslipCustomValues(session.tenantId, id);

  // Effective built-in columns (with per-tenant rename overrides). Fetched
  // for everyone so renames show on the sheet, not just for admins.
  const effBase = await getEffectiveBaseColumns(session.tenantId);
  const baseColumns: BaseCol[] = canEdit ? (effBase as BaseCol[]) : [];
  const baseLabels: Record<string, { label: string; shortLabel: string }> = {};
  for (const b of effBase)
    if (b.overridden)
      baseLabels[b.key] = { label: b.label, shortLabel: b.shortLabel };

  // Resolve names of users who marked payslips paid.
  const paidByIds = [
    ...new Set(slips.map((p) => p.paidBy).filter((x): x is string => !!x)),
  ];
  const paidByUsers = paidByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: paidByIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const userName = new Map(paidByUsers.map((u) => [u.id, u.fullName]));

  // Total OUTSTANDING advance balance per employee (sum across their active
  // advances) — shown as the read-only "Total Advance" column before Advance
  // Recovery so admins see the full balance next to this run's installment.
  const employeeIds = [...new Set(slips.map((p) => p.employeeId))];
  const advanceOutstandingRows = employeeIds.length
    ? await prisma.employeeAdvance.groupBy({
        by: ["employeeId"],
        where: {
          tenantId: session.tenantId,
          employeeId: { in: employeeIds },
          status: "active",
        },
        _sum: { outstanding: true },
      })
    : [];
  const advanceOutstandingByEmp = new Map(
    advanceOutstandingRows.map((r) => [
      r.employeeId,
      Number(r._sum.outstanding ?? 0),
    ])
  );

  // Decimal → plain numbers for the client component.
  const num = (v: unknown) => Number(v ?? 0);

  const sheetSlips: Slip[] = slips.map((p) => {
    const absence = num(p.absenceDeduction);
    const advance = num(p.advanceRecovered);
    const breakPenalty = num(p.breakPenalty);
    const otherDeductions =
      Math.round((num(p.totalDeductions) - absence - advance - breakPenalty + Number.EPSILON) * 100) /
      100;
    // Base field values keyed by PAYROLL_BASE_FIELDS keys → for custom columns.
    const values: Record<string, number> = {
      basicSalary: num(p.basicSalary),
      houseRent: num(p.houseRent),
      health: num(p.health),
      education: num(p.education),
      savings: num(p.savings),
      dailyHand: num(p.dailyHand),
      totalEarnings: num(p.totalEarnings),
      extraDutyDays: num(p.extraDutyDays),
      extraDutyPayment: num(p.extraDutyPayment),
      totalSalary: num(p.totalSalary),
      advanceRecovered: advance,
      breakPenalty,
      absentDays: num(p.absentDays),
      absenceDeduction: absence,
      payableSalary: num(p.payableSalary),
    };
    const custom: Record<string, number> = {};
    for (const c of columnDefs) {
      const v = isManualColumn(c)
        ? manualVals[`${p.id}:${c.id}`] ?? 0
        : computeCustomColumnValue(c, values);
      custom[c.id] = v;
      values[c.id] = v;
    }
    return {
      id: p.id,
      runId: p.runId,
      employeeName: p.employeeName,
      employeeCode: p.employeeCode,
      designation: p.designation,
      salaryGrade: p.salaryGrade,
      basicSalary: values.basicSalary,
      houseRent: values.houseRent,
      health: values.health,
      education: values.education,
      savings: values.savings,
      dailyHand: values.dailyHand,
      totalEarnings: values.totalEarnings,
      extraDutyDays: values.extraDutyDays,
      extraDutyPayment: values.extraDutyPayment,
      totalSalary: values.totalSalary,
      advanceRecovered: advance,
      breakPenalty: values.breakPenalty,
      advanceOutstanding: advanceOutstandingByEmp.get(p.employeeId) ?? 0,
      absentDays: values.absentDays,
      absenceDeduction: absence,
      absenceReason: p.absenceReason ?? null,
      payableSalary: values.payableSalary,
      otherDeductions: otherDeductions > 0 ? otherDeductions : 0,
      custom,
      paidAt: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : null,
      paidByName: p.paidBy ? userName.get(p.paidBy) ?? null : null,
    };
  });

  const colNames: Record<string, string> = Object.fromEntries(
    columnDefs.map((c) => [c.id, c.name])
  );

  const customColumns: CustomCol[] = columnDefs.map((c) => ({
    id: c.id,
    name: c.name,
    shortLabel: c.shortLabel,
    group: c.group as "earning" | "deduction",
    formula: isManualColumn(c) ? "manual entry" : describeCustomColumn(c, colNames),
    manual: isManualColumn(c),
  }));

  const managerColumns: ManagerCol[] = columnDefs.map((c) => ({
    id: c.id,
    name: c.name,
    shortLabel: c.shortLabel,
    group: c.group as "earning" | "deduction",
    formula: parseFormula(c.formula) as ManagerCol["formula"],
    formulaText: describeCustomColumn(c, colNames),
    manual: isManualColumn(c),
  }));

  const baseFields = PAYROLL_BASE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
  }));

  return (
    <div className="space-y-6">
      <AdvanceLiveRefresh tenantId={session.tenantId} />
      <div className="flex items-center justify-between gap-3">
        <Badge variant={run.status === "completed" ? "default" : "outline"}>
          {run.status}
        </Badge>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>{run.period.name} — Salary Sheet</CardTitle>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <SalarySheetFullView
                  title={`${run.period.name} — Salary Sheet`}
                  slips={sheetSlips}
                  canEdit={canEdit}
                  customColumns={customColumns}
                  baseLabels={baseLabels}
                />
                <ColumnManager
                  columns={managerColumns}
                  baseFields={baseFields}
                />
                <BaseColumnManager
                  columns={baseColumns}
                  baseFields={baseFields}
                />
                <form action={refreshRunAdvancesFormAction}>
                  <input type="hidden" name="runId" value={id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    title="Re-sync the Advance column with the current Advances ledger (idempotent)"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh advances
                  </Button>
                </form>
              </div>
            )}
          </div>
          <CardDescription>
            {new Date(run.period.periodStart).toLocaleDateString()} –{" "}
            {new Date(run.period.periodEnd).toLocaleDateString()} · Pay date{" "}
            {new Date(run.period.payDate).toLocaleDateString()} · {run.employeeCount}{" "}
            employee{run.employeeCount !== 1 ? "s" : ""}
            {" · "}
            {canEdit ? (
              <span className="text-primary">
                Editable — click the pencil on a row
              </span>
            ) : (
              <span>Read-only — only owners/admins can edit</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <SalarySheet
            slips={sheetSlips}
            canEdit={canEdit}
            customColumns={customColumns}
            baseLabels={baseLabels}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Gross" value={fmt(run.totalGross)} />
        <SummaryCard label="Total Deductions" value={fmt(run.totalDeductions)} tone="warning" />
        <SummaryCard label="Total Payable" value={fmt(run.totalNet)} tone="success" />
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Component Breakdown</CardTitle>
          <CardDescription>
            Earnings (incl. extra duty) form Total Salary · deductions (advance,
            absence) reduce the payable amount
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {slips.map((p) => (
            <div key={p.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {p.employeeName}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({p.employeeCode})
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Payable: <span className="font-semibold text-success">{fmt(p.payableSalary)}</span>
                </span>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {p.lines.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-md border border-border/40 px-2 py-1 text-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          l.type === "earning"
                            ? "default"
                            : l.type === "reimbursement"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-[9px] capitalize"
                      >
                        {l.type}
                      </Badge>
                      {l.componentName}
                    </span>
                    <span className="font-medium">{fmt(l.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "success";
}) {
  const color =
    tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
