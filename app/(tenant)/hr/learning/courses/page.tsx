import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listCourses } from "@/lib/services/hr/learning.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, BookOpen, Eye, EyeOff } from "lucide-react";
import { createCourseAction, publishCourseAction } from "../../actions-phase2";

export default async function CoursesPage() {
  const session = await requireTenant();
  const courses = await listCourses(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/learning"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {courses.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No courses yet</p>
              </CardContent>
            </Card>
          ) : (
            courses.map((c) => (
              <Card key={c.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{c.title}</CardTitle>
                        <Badge variant="outline" className="text-[10px] capitalize">{c.level}</Badge>
                        {c.isPublished ? <Badge variant="default" className="text-[10px]">Published</Badge> : <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                      </div>
                      <CardDescription>
                        {c.category && `${c.category} · `}
                        {c.durationHours && `${c.durationHours} hrs · `}
                        {c.instructorName && `by ${c.instructorName}`}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">{c._count.modules} modules · {c._count.enrollments} enrollment{c._count.enrollments !== 1 ? "s" : ""}</p>
                      {c.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.description}</p>}
                    </div>
                    <form action={publishCourseAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {c.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </form>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />New Course</CardTitle></CardHeader>
          <CardContent>
            <form action={createCourseAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">Title *</Label>
                <Input id="title" name="title" required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs">Category</Label>
                <Input id="category" name="category" placeholder="Sales, Compliance, IT" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="level" className="text-xs">Level</Label>
                <Select name="level" defaultValue="beginner">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="durationHours" className="text-xs">Duration (hrs)</Label>
                  <Input id="durationHours" name="durationHours" type="number" min="0" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="instructorName" className="text-xs">Instructor</Label>
                  <Input id="instructorName" name="instructorName" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPublished" name="isPublished" className="rounded" />
                <Label htmlFor="isPublished" className="text-xs cursor-pointer">Publish immediately</Label>
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Create</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
