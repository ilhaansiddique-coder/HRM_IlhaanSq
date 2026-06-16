import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { listDepartments, listPositions } from "@/lib/services/hr/department.service";
import { AddEmployeeDialog } from "./_components/add-employee-dialog";
import { EmployeesTable, type EmployeeRow } from "./_components/employees-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Phone, SquarePen, Ban, Trash2 } from "lucide-react";
import { terminateEmployeeAction, deleteEmployeeAction } from "../actions";

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  on_leave: "secondary",
  terminated: "destructive",
  suspended: "outline",
};

const todayYmd = new Date().toISOString().slice(0, 10);

export default async function EmployeesPage() {
  const session = await requireTenant();
  const [employees, departments, positions, activeEmployees] = await Promise.all([
    listEmployees(session.tenantId),
    listDepartments(session.tenantId),
    listPositions(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  // Plain, serializable rows for the client DataTable.
  const rows: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    empCode: e.empCode,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone ?? null,
    department: e.department?.name ?? null,
    position: e.position?.title ?? null,
    status: e.status,
    approvalStatus: e.approvalStatus ?? null,
    hireDate: new Date(e.hireDate).toISOString(),
    // Full defaults for the in-row edit dialog (same form the edit page uses).
    form: {
      fullName: e.fullName,
      email: e.email,
      phone: e.phone ?? undefined,
      dob: e.dob ?? undefined,
      gender: e.gender ?? undefined,
      nationalId: e.nationalId ?? undefined,
      address: e.address ?? undefined,
      emergencyContact: e.emergencyContact ?? undefined,
      emergencyPhone: e.emergencyPhone ?? undefined,
      hireDate: e.hireDate,
      employmentType: e.employmentType,
      departmentId: e.departmentId ?? undefined,
      positionId: e.positionId ?? undefined,
      managerId: e.managerId ?? undefined,
      baseSalary: e.baseSalary != null ? String(e.baseSalary) : undefined,
      currency: e.currency ?? "BDT",
    },
  }));

  return (
    <div className="space-y-6">
      {/* Add Employee opens from the "+" button in the top bar (left of the
          notification bell). Portals into the TopBar; nothing inline. */}
      <AddEmployeeDialog
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
        managers={activeEmployees.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          empCode: e.empCode,
        }))}
      />

      {/* Desktop: the project-wide DataTable (selection, bulk delete,
          pagination, footer count). Mobile uses the card stack below. */}
      <div className="hidden md:block">
        <EmployeesTable
          employees={rows}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          positions={positions.map((p) => ({ id: p.id, title: p.title }))}
          managers={activeEmployees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            empCode: e.empCode,
          }))}
        />
      </div>

      {/* Mobile: same data as a card stack — name + status header, code,
          email/phone contact, dept/position, hired date, actions at bottom. */}
      <div className="md:hidden space-y-3">
        <div>
          <p className="text-base font-semibold">All Employees</p>
          <p className="text-xs text-muted-foreground">Workforce master record</p>
        </div>
        {employees.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Users className="h-10 w-10 opacity-40" />
            <p className="text-sm">
              No employees yet. Use the{" "}
              <span className="font-medium text-foreground">+</span> button in the
              top bar to add your first one.
            </p>
          </Card>
        ) : (
          employees.map((e) => (
            <Card key={e.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{e.fullName}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {e.empCode}
                  </p>
                </div>
                {e.approvalStatus === "pending" ? (
                  <Badge variant="secondary" className="rounded-lg text-[10px]">
                    Pending approval
                  </Badge>
                ) : e.approvalStatus === "rejected" ? (
                  <Badge variant="destructive" className="rounded-lg text-[10px]">
                    Approval rejected
                  </Badge>
                ) : (
                  <Badge
                    variant={statusVariants[e.status] ?? "outline"}
                    className="rounded-lg capitalize"
                  >
                    {e.status.replace("_", " ")}
                  </Badge>
                )}
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 break-all">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span>{e.email}</span>
                </div>
                {e.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{e.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Department: </span>
                  <span className="font-medium">{e.department?.name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Position: </span>
                  <span className="font-medium">{e.position?.title ?? "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Hired: </span>
                  <span className="font-medium">
                    {new Date(e.hireDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 justify-end border-t border-border/60 pt-3">
                <Link href={`/hr/employees/${e.id}`}>
                  <Button variant="outline" size="sm" className="h-8">
                    <SquarePen className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </Link>
                {e.status !== "terminated" && (
                  <form action={terminateEmployeeAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="terminationDate" value={todayYmd} />
                    <Button variant="outline" size="sm" className="h-8 text-destructive/70" type="submit">
                      <Ban className="h-3.5 w-3.5" />
                      Terminate
                    </Button>
                  </form>
                )}
                {e.status === "terminated" && (
                  <form action={deleteEmployeeAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <Button variant="outline" size="sm" className="h-8 text-destructive/70" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
