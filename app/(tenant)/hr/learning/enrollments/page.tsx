import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listEnrollments, listCourses } from "@/lib/services/hr/learning.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Award, GraduationCap } from "lucide-react";
import { enrollAction, updateProgressAction } from "../../actions-phase2";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  enrolled: "outline",
  in_progress: "secondary",
  completed: "default",
  dropped: "destructive",
};

export default async function EnrollmentsPage() {
  const session = await requireTenant();
  const [enrollments, courses, employees] = await Promise.all([
    listEnrollments(session.tenantId),
    listCourses(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const publishedCourses = courses.filter((c) => c.isPublished);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/learning"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {enrollments.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No enrollments yet</p>
              </CardContent>
            </Card>
          ) : (
            enrollments.map((e) => (
              <Card key={e.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{e.employee.fullName}</CardTitle>
                        <Badge variant={statusColors[e.status]} className="text-[10px]">{e.status.replace("_", " ")}</Badge>
                      </div>
                      <CardDescription>{e.course.title}</CardDescription>
                      {e.certification && (
                        <p className="text-xs text-success mt-1 flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {e.certification.certificateNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{e.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${e.progress}%` }} />
                    </div>
                  </div>
                  {e.status !== "completed" && (
                    <form action={updateProgressAction} className="flex gap-2 items-end pt-2 border-t border-border/60">
                      <input type="hidden" name="id" value={e.id} />
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Update progress (%)</Label>
                        <Input name="progress" type="number" min="0" max="100" defaultValue={e.progress} />
                      </div>
                      <Button type="submit" size="sm">Update</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Enroll Employee</CardTitle></CardHeader>
          <CardContent>
            <form action={enrollAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Course *</Label>
                <Select name="courseId" required>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {publishedCourses.length === 0 ? <SelectItem value="_none" disabled>No published courses</SelectItem> : publishedCourses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Employee *</Label>
                <Select name="employeeId" required>
                  <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName} ({e.empCode})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Enroll</Button>
              <p className="text-[10px] text-muted-foreground text-center">A certificate is auto-issued on 100% progress.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
