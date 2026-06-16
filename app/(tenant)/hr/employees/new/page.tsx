import { requireTenant } from "@/lib/auth";
import { listDepartments, listPositions } from "@/lib/services/hr/department.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmployeeForm } from "../_components/employee-form";

export default async function NewEmployeePage() {
  const session = await requireTenant();
  const [departments, positions, employees] = await Promise.all([
    listDepartments(session.tenantId),
    listPositions(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
          <CardDescription>
            Required fields are marked with a red asterisk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm departments={departments} positions={positions} managers={employees} />
        </CardContent>
      </Card>
    </div>
  );
}
