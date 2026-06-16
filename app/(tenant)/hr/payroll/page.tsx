import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import {
  getPayrollStats,
  listPayrollRuns,
  getPayrollPrep,
} from "@/lib/services/hr/payroll.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { FileText, Layers, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import { RunPayrollDialog } from "./_components/run-payroll-dialog";
import { PayrollRunsTable, type RunRow } from "./runs/_components/payroll-runs-table";
import { resolveDateBounds } from "@/lib/date-range";

export default async function PayrollOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Global top-bar date filter applies to the payroll-runs list (by run date).
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");

  const [stats, runs, prep] = await Promise.all([
    getPayrollStats(session.tenantId),
    listPayrollRuns(session.tenantId, {
      ...(start && { from: start }),
      ...(end && { to: end }),
    }),
    getPayrollPrep(session.tenantId, monthStart, monthEnd),
  ]);
  const hasStructure = stats.structureCount > 0;
  const hasSalary = stats.activeSalaryCount > 0;
  const ready = hasStructure && hasSalary;

  // Plain serializable rows for the shared DataTable.
  const runRows: RunRow[] = runs.map((r) => ({
    id: r.id,
    periodName: r.period.name,
    payDate: new Date(r.period.payDate).toISOString(),
    employeeCount: r.employeeCount,
    totalGross: Number(r.totalGross),
    totalDeductions: Number(r.totalDeductions),
    totalNet: Number(r.totalNet),
    status: r.status,
    runAt: new Date(r.runAt).toISOString(),
  }));

  // Runs history — full table on desktop, card stack on mobile.
  const runsContent = (
    <>
      <div className="hidden md:block">
        {runs.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-40" />
            <p className="text-sm">No payroll runs yet.</p>
          </Card>
        ) : (
          <PayrollRunsTable rows={runRows} />
        )}
      </div>

      <div className="md:hidden space-y-3">
        {runs.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-40" />
            <span className="text-sm">No payroll runs yet</span>
          </Card>
        ) : (
          runs.map((r) => (
            <Card key={r.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/hr/payroll/runs/${r.id}`} className="font-medium leading-tight text-primary hover:underline">
                    {r.period.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pay date: {new Date(r.period.payDate).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={r.status === "completed" ? "default" : "outline"}
                  className="rounded-lg"
                >
                  {r.status}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2">
                  <span className="text-muted-foreground">Employees: </span>
                  <span className="font-semibold">{r.employeeCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Gross: </span>
                  <span className="font-medium">{Number(r.totalGross).toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Deductions: </span>
                  <span className="font-medium text-warning">{Number(r.totalDeductions).toLocaleString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Net Pay: </span>
                  <span className="font-bold text-success">{Number(r.totalNet).toLocaleString()}</span>
                </div>
                <div className="col-span-2 text-muted-foreground">
                  Run at: {new Date(r.runAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Run Payroll also opens from the "+" button in the top bar (left of the
          notification bell). Advances live in the Payroll submenu; Salary
          Structure lives in Settings. */}
      <RunPayrollDialog hasStructure={hasStructure} hasSalary={hasSalary} prep={prep} />

      {/* Analytics — at the top. */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<Layers className="h-4 w-4" />} title="Salary Structures" value={stats.structureCount} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} title="Active Salaries" value={stats.activeSalaryCount} variant="success" />
        <StatCard icon={<FileText className="h-4 w-4" />} title="Payroll Runs" value={stats.runCount} />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          title="Last Run"
          value={stats.lastRun ? new Date(stats.lastRun.completedAt!).toLocaleDateString() : "—"}
          hint={stats.lastRun?.period.name}
        />
      </div>

      {/* Setup-required warning — only while payroll can't run yet. */}
      {!ready && (
        <Card className="border-warning/35 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Setup required
            </CardTitle>
            <CardDescription>
              You need a salary structure AND at least one employee with a salary
              assigned before running payroll.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!hasStructure && (
              <p>
                · No salary structures —{" "}
                <Link href="/settings" className="text-primary underline">
                  create one in Settings → Salary Structure
                </Link>
              </p>
            )}
            {hasStructure && !hasSalary && (
              <p>
                · No employees have a salary assigned —{" "}
                <Link href="/hr/payroll/assign" className="text-primary underline">
                  assign a salary
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll runs history. */}
      {runsContent}

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Terms of payment:</strong> Gross = Basic + earning
        allowances. Absence Deduction = (Basic ÷ 30) × absent days. Payable Salary = Gross −
        Advance − Absence. Amount Paid = Gross − Absence + D.H. Expenses (reimbursements paid
        on top). Advances recover automatically each run until cleared.
        <br />
        <span className="text-warning">Not yet included:</span> country-specific tax engines
        (NBR, TDS, GOSI, PAYE) and statutory reporting — the data model is ready for that expansion.
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, hint, variant }: { icon: ReactNode; title: string; value: number | string; hint?: string; variant?: "success" }) {
  return (
    <MetricCard
      icon={icon}
      label={title}
      value={typeof value === "number" ? value.toLocaleString() : value}
      subtitle={hint}
      tone={variant === "success" ? "success" : "primary"}
    />
  );
}
