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
import { Plus, Users, Mail, Phone } from "lucide-react";

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  on_leave: "secondary",
  terminated: "destructive",
  suspended: "outline",
};

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
                        <Badge variant={statusVariants[e.status] ?? "outline"} className="capitalize">
                          {e.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.hireDate).toLocaleDateString()}
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
          email/phone contact, dept/position, hired date. */}
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
                <Badge
                  variant={statusVariants[e.status] ?? "outline"}
                  className="rounded-lg capitalize"
                >
                  {e.status.replace("_", " ")}
                </Badge>
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
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
