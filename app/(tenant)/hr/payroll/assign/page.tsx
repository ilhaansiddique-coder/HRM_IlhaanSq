import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import {
  listSalaryStructures,
  getPayrollStats,
  getPayrollPrep,
} from "@/lib/services/hr/payroll.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { AssignSalaryForm } from "../runs/new/_components/assign-salary-form";
import { RunPayrollDialog } from "../_components/run-payroll-dialog";

export default async function AssignSalaryPage() {
  const session = await requireTenant();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [structures, stats, employees, prep] = await Promise.all([
    listSalaryStructures(session.tenantId),
    getPayrollStats(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
    getPayrollPrep(session.tenantId, monthStart, monthEnd),
  ]);

  const ready = structures.length > 0 && stats.activeSalaryCount > 0;

  return (
    <div className="space-y-6">
      {/* Run Payroll opens from the "+" button in the top bar (left of the
          notification bell). This page handles the salary-assignment setup. */}
      <RunPayrollDialog hasStructure={structures.length > 0} hasSalary={stats.activeSalaryCount > 0} prep={prep} />

      {!ready && (
        <Card className="border-warning/35 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-warning" />Setup required</CardTitle>
            <CardDescription>You need a salary structure AND at least one employee with a salary assigned before running payroll.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {structures.length === 0 && <p>· No salary structures — <Link href="/settings" className="text-primary underline">create one in Settings</Link></p>}
            {stats.activeSalaryCount === 0 && structures.length > 0 && <p>· No employees have a salary assigned — use the form below</p>}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card/80 mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>Assign Salary to Employee</CardTitle>
          <CardDescription>
            Link an employee to a salary structure. Once at least one employee has
            a salary, run payroll with the <strong>+</strong> in the top bar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignSalaryForm
            employees={employees.map((e) => ({ id: e.id, name: e.fullName, code: e.empCode }))}
            structures={structures.map((s) => ({ id: s.id, name: s.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
