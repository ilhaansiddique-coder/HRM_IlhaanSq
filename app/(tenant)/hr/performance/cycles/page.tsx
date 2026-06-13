import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listReviewCycles } from "@/lib/services/hr/performance.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, X, Calendar } from "lucide-react";
import {
  activateCycleAction,
  closeCycleAction,
} from "../../actions-phase2";
import { NewCycleDialog } from "./_components/new-cycle-dialog";

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  closed: "secondary",
};

export default async function CyclesPage() {
  const session = await requireTenant();
  const cycles = await listReviewCycles(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/performance"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {/* The New Cycle form opens from the "+" button in the top bar (left of the
          notification bell). Portals into the TopBar; nothing inline here. */}
      <NewCycleDialog />

      <div className="space-y-3">
          {cycles.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No cycles yet</p>
              </CardContent>
            </Card>
          ) : (
            cycles.map((c) => (
              <Card key={c.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <CardDescription>
                        {c.type} · {new Date(c.startDate).toLocaleDateString()} → {new Date(c.endDate).toLocaleDateString()}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">{c._count.goals} goals · {c._count.reviews} reviews</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariants[c.status]}>{c.status}</Badge>
                      {c.status === "draft" && (
                        <form action={activateCycleAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" size="sm" variant="outline"><Play className="h-3 w-3" />Activate</Button>
                        </form>
                      )}
                      {c.status === "active" && (
                        <form action={closeCycleAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" size="sm" variant="outline"><X className="h-3 w-3" />Close</Button>
                        </form>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
    </div>
  );
}
