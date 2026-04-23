import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listSalaryStructures, getPayrollStats } from "@/lib/services/hr/payroll.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { RunPayrollForm } from "./_components/run-payroll-form";
import { AssignSalaryForm } from "./_components/assign-salary-form";

export default async function NewRunPage() {
  const session = await requireTenant();
  const [structures, stats, employees] = await Promise.all([
    listSalaryStructures(session.tenantId),
    getPayrollStats(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const ready = structures.length > 0 && stats.activeSalaryCount > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {!ready && (
        <Card className="border-warning/35 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-warning" />Setup required</CardTitle>
            <CardDescription>You need a salary structure AND at least one employee with a salary assigned before running payroll.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {structures.length === 0 && <p>· No salary structures — <Link href="/hr/payroll/structures" className="text-primary underline">create one</Link></p>}
            {stats.activeSalaryCount === 0 && structures.length > 0 && <p>· No employees have a salary assigned — use the form below</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Run Payroll for Period</CardTitle>
            <CardDescription>Calculates payslips for all active employees</CardDescription>
          </CardHeader>
          <CardContent>
            <RunPayrollForm disabled={!ready} />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Assign Salary to Employee</CardTitle>
            <CardDescription>Link an employee to a salary structure</CardDescription>
          </CardHeader>
          <CardContent>
            <AssignSalaryForm
              employees={employees.map((e) => ({ id: e.id, name: e.fullName, code: e.empCode }))}
              structures={structures.map((s) => ({ id: s.id, name: s.name }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
