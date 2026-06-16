import { requireTenant } from "@/lib/auth";
import { listPositions, listDepartments } from "@/lib/services/hr/department.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import {
  PositionRowActions,
  type PositionRow,
} from "./_components/position-row-actions";
import { PositionsTable } from "./_components/positions-table";
import { NewPositionDialog } from "./_components/new-position-dialog";

export default async function PositionsPage() {
  const session = await requireTenant();
  const [positions, departments] = await Promise.all([
    listPositions(session.tenantId),
    listDepartments(session.tenantId),
  ]);
  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }));
  const rows: PositionRow[] = positions.map((p) => ({
    id: p.id,
    title: p.title,
    departmentId: p.departmentId,
    grade: p.grade,
    band: p.band,
    jobFamily: p.jobFamily,
    isManager: p.isManager,
    description: p.description,
    employeeCount: p._count.employees,
  }));

  return (
    <div className="space-y-6">
      {/* New Position opens from the "+" button in the top bar (left of the
          notification bell). Portals into the TopBar; nothing inline. */}
      <NewPositionDialog departments={deptOptions} />

      <div className="space-y-3">
          {/* Desktop: the project-wide DataTable (no heading/border card). */}
          <div className="hidden md:block">
            <PositionsTable rows={rows} departments={deptOptions} />
          </div>

          {/* Mobile: position card stack — title + holder count, department,
              grade/band, optional delete action. */}
          <div className="md:hidden space-y-3">
            <p className="text-base font-semibold">
              All Positions ({positions.length})
            </p>
            {positions.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 opacity-40" />
                <span className="text-sm">
                  No positions yet. Define a job title to get started.
                </span>
              </Card>
            ) : (
              positions.map((p) => (
                <Card key={p.id} className="rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">
                        {p.title}
                        {p.isManager && (
                          <Badge
                            variant="secondary"
                            className="ml-2 text-[10px]"
                          >
                            Manager
                          </Badge>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-lg">
                      {p._count.employees} holder
                      {p._count.employees !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Department: </span>
                      <span className="font-medium">
                        {p.department?.name ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Salary Grade: </span>
                      <span className="font-medium">{p.grade ?? "—"}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <PositionRowActions
                      variant="full"
                      departments={deptOptions}
                      position={{
                        id: p.id,
                        title: p.title,
                        departmentId: p.departmentId,
                        grade: p.grade,
                        band: p.band,
                        jobFamily: p.jobFamily,
                        isManager: p.isManager,
                        description: p.description,
                        employeeCount: p._count.employees,
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
