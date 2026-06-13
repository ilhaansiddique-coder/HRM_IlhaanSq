import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listGoals, listReviewCycles } from "@/lib/services/hr/performance.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Target, Trash2 } from "lucide-react";
import {
  updateGoalAction,
  deleteGoalAction,
} from "../../actions-phase2";
import { NewGoalDialog } from "./_components/new-goal-dialog";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  not_started: "outline",
  in_progress: "secondary",
  achieved: "default",
  missed: "destructive",
  cancelled: "outline",
};

export default async function GoalsPage() {
  const session = await requireTenant();
  const [goals, cycles, employees] = await Promise.all([
    listGoals(session.tenantId),
    listReviewCycles(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/performance"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {/* The New Goal form opens from the "+" button in the top bar (left of the
          notification bell). Portals into the TopBar; nothing inline here. */}
      <NewGoalDialog
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, empCode: e.empCode }))}
        cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
      />

      <div className="space-y-3">
          {goals.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No goals yet</p>
              </CardContent>
            </Card>
          ) : (
            goals.map((g) => (
              <Card key={g.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{g.title}</CardTitle>
                        <Badge variant="outline" className="text-[10px] uppercase">{g.type}</Badge>
                        <Badge variant={statusColors[g.status]} className="text-[10px]">{g.status.replace("_", " ")}</Badge>
                      </div>
                      <CardDescription>{g.employee.fullName} {g.cycle && `· ${g.cycle.name}`}</CardDescription>
                      {g.description && <p className="text-xs text-muted-foreground mt-1">{g.description}</p>}
                    </div>
                    <form action={deleteGoalAction}>
                      <input type="hidden" name="id" value={g.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {g.targetValue ? `${Number(g.currentValue)} / ${Number(g.targetValue)} ${g.unit ?? ""}` : "Progress"}
                      </span>
                      <span className="font-medium">{g.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
                    </div>
                  </div>
                  <form action={updateGoalAction} className="flex gap-2 items-end pt-2 border-t border-border/60">
                    <input type="hidden" name="id" value={g.id} />
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Update progress (%)</Label>
                      <Input name="progress" type="number" min="0" max="100" defaultValue={g.progress} />
                    </div>
                    {g.targetValue && (
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Current value</Label>
                        <Input name="currentValue" type="number" step="0.01" defaultValue={Number(g.currentValue)} />
                      </div>
                    )}
                    <Button type="submit" size="sm">Update</Button>
                  </form>
                </CardContent>
              </Card>
            ))
          )}
        </div>
    </div>
  );
}
