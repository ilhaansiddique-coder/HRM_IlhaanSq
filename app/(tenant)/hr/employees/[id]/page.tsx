import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { getEmployee } from "@/lib/services/hr/employee.service";
import { listDepartments, listPositions } from "@/lib/services/hr/department.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "../_components/employee-form";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireTenant();
  const [employee, departments, positions, managers] = await Promise.all([
    getEmployee(session.tenantId, id),
    listDepartments(session.tenantId),
    listPositions(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  if (!employee) notFound();

  const dv = {
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone ?? undefined,
    dob: employee.dob ? employee.dob.toISOString() : undefined,
    gender: employee.gender ?? undefined,
    nationalId: employee.nationalId ?? undefined,
    address: employee.address ?? undefined,
    emergencyContact: employee.emergencyContact ?? undefined,
    emergencyPhone: employee.emergencyPhone ?? undefined,
    hireDate: employee.hireDate.toISOString(),
    employmentType: employee.employmentType,
    departmentId: employee.departmentId ?? undefined,
    positionId: employee.positionId ?? undefined,
    managerId: employee.managerId ?? undefined,
    baseSalary: employee.baseSalary ? String(employee.baseSalary) : undefined,
    currency: employee.currency ?? "BDT",
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Edit Employee</CardTitle>
          <CardDescription>
            {employee.fullName} · {employee.empCode}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            mode="edit"
            employeeId={id}
            defaultValues={dv}
            departments={departments}
            positions={positions}
            managers={managers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
