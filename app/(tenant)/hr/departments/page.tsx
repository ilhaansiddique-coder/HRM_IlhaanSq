import { requireTenant } from "@/lib/auth";
import { listDepartments } from "@/lib/services/hr/department.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import {
  DepartmentRowActions,
  type DepartmentRow,
} from "./_components/department-row-actions";
import { DepartmentsTable } from "./_components/departments-table";
import { NewDepartmentDialog } from "./_components/new-department-dialog";

export default async function DepartmentsPage() {
  const session = await requireTenant();
  const departments = await listDepartments(session.tenantId);
  const rows: DepartmentRow[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    costCenter: d.costCenter,
    description: d.description,
    employeeCount: d._count.employees,
  }));

  return (
    <div className="space-y-6">
      {/* New Department opens from the "+" button in the top bar (left of the
          notification bell). Portals into the TopBar; nothing inline. */}
      <NewDepartmentDialog />

      {/* List wrapper — desktop table + mobile card stack */}
      <div className="space-y-3">
          {/* Desktop: the project-wide DataTable (no heading/border card). */}
          <div className="hidden md:block">
            <DepartmentsTable rows={rows} />
          </div>

          {/* Mobile: department card stack — name + employee count header,
              code + cost center, optional delete action. */}
          <div className="md:hidden space-y-3">
            <p className="text-base font-semibold">
              All Departments ({departments.length})
            </p>
            {departments.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Building2 className="h-10 w-10 opacity-40" />
                <span className="text-sm">
                  No departments yet. Create one to start organizing your team.
                </span>
              </Card>
            ) : (
              departments.map((d) => (
                <Card key={d.id} className="rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{d.name}</p>
                    </div>
                    <Badge variant="outline" className="rounded-lg">
                      {d._count.employees} employee
                      {d._count.employees !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="mt-3 text-xs">
                    <span className="text-muted-foreground">Description: </span>
                    <span className="font-medium">{d.description ?? "—"}</span>
                  </div>

                  <div className="mt-3">
                    <DepartmentRowActions
                      variant="full"
                      department={{
                        id: d.id,
                        name: d.name,
                        code: d.code,
                        costCenter: d.costCenter,
                        description: d.description,
                        employeeCount: d._count.employees,
                      }}
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
  );
}
