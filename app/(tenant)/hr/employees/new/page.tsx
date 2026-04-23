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
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewEmployeePage() {
  const session = await requireTenant();
  const [departments, positions, employees] = await Promise.all([
    listDepartments(session.tenantId),
    listPositions(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/hr/employees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Employee</h1>
          <p className="text-sm text-muted-foreground">
            Create a new employee record
          </p>
        </div>
      </div>

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
