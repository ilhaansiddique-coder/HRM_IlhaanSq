import { requireTenant } from "@/lib/auth";
import {
  listSalaryStructures,
  getPayrollStats,
} from "@/lib/services/hr/payroll.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { AssignSalaryForm } from "../../hr/payroll/runs/new/_components/assign-salary-form";

// Assign Salary — relocated from /hr/payroll/assign into the Settings page
// (Assign Salary tab).
export async function AssignSalarySection() {
  const session = await requireTenant();
  const [structures, stats, employees] = await Promise.all([
    listSalaryStructures(session.tenantId),
    getPayrollStats(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const ready = structures.length > 0 && stats.activeSalaryCount > 0;

  return (
    <div className="space-y-6">
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
            {structures.length === 0 && (
              <p>
                · No salary structures — create one in the{" "}
                <strong>Salary Structure</strong> tab
              </p>
            )}
            {stats.activeSalaryCount === 0 && structures.length > 0 && (
              <p>· No employees have a salary assigned — use the form below</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card/80 mx-auto w-[1150px] max-w-full">
        <CardHeader>
          <CardTitle>Assign Salary to Employee</CardTitle>
          <CardDescription>
            Link an employee to a salary structure. Once at least one employee
            has a salary, run payroll with the <strong>+</strong> in the top bar
            on the Payroll page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignSalaryForm
            employees={employees.map((e) => ({
              id: e.id,
              name: e.fullName,
              code: e.empCode,
            }))}
            structures={structures.map((s) => ({ id: s.id, name: s.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}