import { requireTenant } from "@/lib/auth";
import { listDepartments } from "@/lib/services/hr/department.service";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus } from "lucide-react";
import { createDepartmentAction } from "../actions";
import { DepartmentRowActions } from "./_components/department-row-actions";

export default async function DepartmentsPage() {
  const session = await requireTenant();
  const departments = await listDepartments(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* List wrapper — desktop table + mobile card stack */}
        <div className="space-y-3">
          {/* Desktop: table view. Mobile uses the card stack below. */}
          <Card className="hidden md:block border-border/70 bg-card/80 rounded-lg">
            <CardHeader>
              <CardTitle>All Departments ({departments.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {departments.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No departments yet. Create one to start organizing your team.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Cost Center</TableHead>
                        <TableHead className="text-right">Employees</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {d.code ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.costCenter ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{d._count.employees}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DepartmentRowActions
                              department={{
                                id: d.id,
                                name: d.name,
                                code: d.code,
                                costCenter: d.costCenter,
                                description: d.description,
                                employeeCount: d._count.employees,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Code: </span>
                      <span className="font-mono font-medium">
                        {d.code ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cost Center: </span>
                      <span className="font-medium">{d.costCenter ?? "—"}</span>
                    </div>
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

        {/* Create form */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              New Department
            </CardTitle>
            <CardDescription>Add a business unit</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createDepartmentAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" name="name" required minLength={2} placeholder="Sales" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs">Code</Label>
                <Input id="code" name="code" placeholder="SALES" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="costCenter" className="text-xs">Cost Center</Label>
                <Input id="costCenter" name="costCenter" placeholder="CC-1001" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Add Department
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
