import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listReviews, listReviewCycles } from "@/lib/services/hr/performance.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
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
import { ArrowLeft, Plus, MessageSquare, Star } from "lucide-react";
import { createReviewAction } from "../../actions-phase2";

export default async function ReviewsPage() {
  const session = await requireTenant();
  const [reviews, cycles, employees] = await Promise.all([
    listReviews(session.tenantId),
    listReviewCycles(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/performance"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Reviews</h1>
          <p className="text-sm text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No reviews yet</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((r) => (
              <Card key={r.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {r.employee.fullName}
                        <Badge variant="outline" className="text-[10px] uppercase">{r.type}</Badge>
                      </CardTitle>
                      <CardDescription>By {r.reviewer.fullName} · {r.cycle.name}</CardDescription>
                    </div>
                    {r.overallRating && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < r.overallRating! ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {r.strengths && <div><p className="text-xs font-semibold text-success">Strengths</p><p className="text-muted-foreground">{r.strengths}</p></div>}
                  {r.improvements && <div><p className="text-xs font-semibold text-warning">Improvements</p><p className="text-muted-foreground">{r.improvements}</p></div>}
                  {r.comments && <div><p className="text-xs font-semibold text-primary">Comments</p><p className="text-muted-foreground">{r.comments}</p></div>}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Submit Review</CardTitle></CardHeader>
          <CardContent>
            <form action={createReviewAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cycle *</Label>
                <Select name="cycleId" required>
                  <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                  <SelectContent>
                    {cycles.length === 0 ? <SelectItem value="_none" disabled>No cycles</SelectItem> : cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Employee *</Label>
                <Select name="employeeId" required>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reviewer *</Label>
                <Select name="reviewerId" required>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select name="type" defaultValue="manager">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="peer">Peer</SelectItem>
                    <SelectItem value="upward">Upward</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rating (1-5)</Label>
                <Input name="overallRating" type="number" min="1" max="5" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Strengths</Label>
                <Textarea name="strengths" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Improvements</Label>
                <Textarea name="improvements" rows={2} />
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Submit Review</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
