import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getPayrollStats, listPayrollRuns, getPayrollPrep } from "@/lib/services/hr/payroll.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, FileText, Layers, CheckCircle2, Calendar } from "lucide-react";
import { RunPayrollDialog } from "./_components/run-payroll-dialog";

export default async function PayrollOverviewPage() {
  const session = await requireTenant();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [stats, runs, prep] = await Promise.all([
    getPayrollStats(session.tenantId),
    listPayrollRuns(session.tenantId),
    getPayrollPrep(session.tenantId, monthStart, monthEnd),
  ]);
  const hasStructure = stats.structureCount > 0;
  const hasSalary = stats.activeSalaryCount > 0;

  return (
    <div className="space-y-6">
      {/* Run Payroll opens from the "+" button in the top bar (left of the
          notification bell). Advances and Salary Structure are now reached via
          the sidebar (Payroll submenu) and Settings respectively. */}
      <RunPayrollDialog hasStructure={hasStructure} hasSalary={hasSalary} prep={prep} />

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

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Payroll Runs
            </CardTitle>
            <CardDescription>{runs.length} run{runs.length !== 1 ? "s" : ""} executed</CardDescription>
          </div>
          <Link href="/hr/payroll/runs">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm mb-3">No payroll runs yet.</p>
              <Link href="/hr/payroll/runs/new">
                <Button size="sm"><Plus className="h-3.5 w-3.5" />Run first payroll</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <div>
                    <p className="font-medium text-sm">{r.period.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.employeeCount} employee{r.employeeCount !== 1 ? "s" : ""} · Net: {Number(r.totalNet).toLocaleString()} · {new Date(r.runAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={r.status === "completed" ? "default" : "outline"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
  const iconBg = variant === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
