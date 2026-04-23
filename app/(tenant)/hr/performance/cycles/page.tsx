import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listReviewCycles } from "@/lib/services/hr/performance.service";
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
import { ArrowLeft, Plus, Play, X, Calendar } from "lucide-react";
import {
  createCycleAction,
  activateCycleAction,
  closeCycleAction,
} from "../../actions-phase2";

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Cycles</h1>
          <p className="text-sm text-muted-foreground">Annual, quarterly or monthly review periods</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />New Cycle</CardTitle></CardHeader>
          <CardContent>
            <form action={createCycleAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Name *</Label>
                <Input id="name" name="name" required minLength={2} placeholder="2026 Annual Review" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs">Type</Label>
                <Select name="type" defaultValue="annual">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs">From</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs">To</Label>
                  <Input id="endDate" name="endDate" type="date" required />
                </div>
              </div>
              <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Create</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
