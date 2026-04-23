import { requireTenant } from "@/lib/auth";
import { listPositions, listDepartments } from "@/lib/services/hr/department.service";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import {
  createPositionAction,
  deletePositionAction,
} from "../actions";

export default async function PositionsPage() {
  const session = await requireTenant();
  const [positions, departments] = await Promise.all([
    listPositions(session.tenantId),
    listDepartments(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>All Positions ({positions.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {positions.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No positions yet. Define a job title to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Band</TableHead>
                      <TableHead className="text-right">Holders</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.title}
                          {p.isManager && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              Manager
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.department?.name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.grade ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.band ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{p._count.employees}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p._count.employees === 0 && (
                            <form action={deletePositionAction} className="inline">
                              <input type="hidden" name="id" value={p.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              New Position
            </CardTitle>
            <CardDescription>Add a job title</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createPositionAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input id="title" name="title" required minLength={2} placeholder="Sales Manager" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="departmentId" className="text-xs">Department</Label>
                <Select name="departmentId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.length === 0 ? (
                      <SelectItem value="_none" disabled>No departments</SelectItem>
                    ) : (
                      departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="grade" className="text-xs">Grade</Label>
                  <Input id="grade" name="grade" placeholder="L4" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="band" className="text-xs">Band</Label>
                  <Input id="band" name="band" placeholder="Senior" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jobFamily" className="text-xs">Job Family</Label>
                <Input id="jobFamily" name="jobFamily" placeholder="Sales" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="isManager" name="isManager" className="rounded" />
                <Label htmlFor="isManager" className="text-xs cursor-pointer">
                  This is a manager role
                </Label>
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Add Position
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
