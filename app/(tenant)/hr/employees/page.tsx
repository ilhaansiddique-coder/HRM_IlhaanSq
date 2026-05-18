import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Users, Mail, Phone, Pencil, Ban, Trash2 } from "lucide-react";
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
  const employees = await listEmployees(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Link href="/hr/employees/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </Link>
      </div>

      {/* Desktop: table view. Mobile uses the card stack below. */}
      <Card className="hidden md:block border-border/70 bg-card/80 rounded-lg">
        <CardHeader>
          <CardTitle>All Employees</CardTitle>
          <CardDescription>Workforce master record</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                No employees yet. Add your first one to get started.
              </p>
              <Link href="/hr/employees/new">
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Add Employee
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hired</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.empCode}</TableCell>
                      <TableCell className="font-medium">{e.fullName}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{e.email}</span>
                          </div>
                          {e.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{e.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.department?.name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.position?.title ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {e.approvalStatus === "pending" ? (
                            <Badge variant="secondary" className="text-[10px]">Pending approval</Badge>
                          ) : e.approvalStatus === "rejected" ? (
                            <Badge variant="destructive" className="text-[10px]">Approval rejected</Badge>
                          ) : (
                            <Badge variant={statusVariants[e.status] ?? "outline"} className="capitalize">
                              {e.status.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.hireDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Link href={`/hr/employees/${e.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit employee">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          {e.status !== "terminated" && (
                            <form action={terminateEmployeeAction}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="terminationDate" value={todayYmd} />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                type="submit"
                                title="Terminate employee"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          )}
                          {e.status === "terminated" && (
                            <form action={deleteEmployeeAction}>
                              <input type="hidden" name="id" value={e.id} />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                type="submit"
                                title="Delete permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile: same data as a card stack — name + status header, code,
          email/phone contact, dept/position, hired date, actions at bottom. */}
      <div className="md:hidden space-y-3">
        <div>
          <p className="text-base font-semibold">All Employees</p>
          <p className="text-xs text-muted-foreground">Workforce master record</p>
        </div>
        {employees.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Users className="h-10 w-10 opacity-40" />
            <p className="text-sm">No employees yet. Add your first one to get started.</p>
            <Link href="/hr/employees/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add Employee
              </Button>
            </Link>
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
                    <Pencil className="h-3.5 w-3.5" />
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
