import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listCourses } from "@/lib/services/hr/learning.service";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Eye, EyeOff } from "lucide-react";
import { publishCourseAction } from "../../actions-phase2";
import { NewCourseDialog } from "./_components/new-course-dialog";

export default async function CoursesPage() {
  const session = await requireTenant();
  const courses = await listCourses(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/learning"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {/* The new-course form lives in a dialog opened from the "+" button in the
          top bar (left of the notification bell). This portals its trigger +
          dialog into the TopBar and renders nothing inline here. */}
      <NewCourseDialog />

      {courses.length === 0 ? (
        <Card className="border-border/70 bg-card/40">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No courses yet</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead className="text-right">Modules</TableHead>
              <TableHead className="text-right">Enrollments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell className="text-muted-foreground">{c.category || "—"}</TableCell>
                <TableCell className="capitalize">{c.level}</TableCell>
                <TableCell className="text-right">{c.durationHours ? `${c.durationHours} hrs` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.instructorName || "—"}</TableCell>
                <TableCell className="text-right">{c._count.modules}</TableCell>
                <TableCell className="text-right">{c._count.enrollments}</TableCell>
                <TableCell>
                  {c.isPublished ? (
                    <Badge variant="default" className="text-[10px]">Published</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Draft</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <form action={publishCourseAction} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="ghost" size="sm" title={c.isPublished ? "Unpublish" : "Publish"}>
                      {c.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
