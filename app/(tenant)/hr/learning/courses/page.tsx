import { requireTenant } from "@/lib/auth";
import { listCourses } from "@/lib/services/hr/learning.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { publishCourseAction } from "../../actions-phase2";
import { NewCourseDialog } from "./_components/new-course-dialog";
import { CoursesTable, type CourseRow } from "./_components/courses-table";

export default async function CoursesPage() {
  const session = await requireTenant();
  const courses = await listCourses(session.tenantId);

  // Plain, serializable rows for the client DataTable.
  const rows: CourseRow[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category || "—",
    level: c.level,
    duration: c.durationHours ? `${c.durationHours} hrs` : "—",
    instructor: c.instructorName || "—",
    moduleCount: c._count.modules,
    enrollmentCount: c._count.enrollments,
    isPublished: c.isPublished,
  }));

  return (
    <div className="space-y-6">
      {/* The new-course form lives in a dialog opened from the "+" button in the
          top bar (left of the notification bell). This portals its trigger +
          dialog into the TopBar and renders nothing inline here. */}
      <NewCourseDialog />

      {/* Desktop: the project-wide DataTable. Mobile uses the card stack below. */}
      <div className="hidden md:block">
        <CoursesTable rows={rows} />
      </div>

      {/* Mobile: same data as a card stack. */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <Card className="border-border/70 bg-card/40">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No courses yet</p>
            </CardContent>
          </Card>
        ) : (
          rows.map((c) => (
            <Card key={c.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                    {c.category} · {c.level}
                  </p>
                </div>
                {c.isPublished ? (
                  <Badge variant="default" className="rounded-lg text-[10px]">Published</Badge>
                ) : (
                  <Badge variant="outline" className="rounded-lg text-[10px]">Draft</Badge>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Duration: </span>
                  <span className="font-medium">{c.duration}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Instructor: </span>
                  <span className="font-medium">{c.instructor}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Modules: </span>
                  <span className="font-medium">{c.moduleCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Enrollments: </span>
                  <span className="font-medium">{c.enrollmentCount}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end border-t border-border/60 pt-3">
                <form action={publishCourseAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="outline" size="sm" className="h-8">
                    {c.isPublished ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Publish
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
