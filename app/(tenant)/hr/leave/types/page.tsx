import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listLeaveTypes } from "@/lib/services/hr/leave.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, CalendarDays } from "lucide-react";
import {
  createLeaveTypeAction,
  deleteLeaveTypeAction,
} from "../../actions";

export default async function LeaveTypesPage() {
  const session = await requireTenant();
  const types = await listLeaveTypes(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/leave">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Types</h1>
          <p className="text-sm text-muted-foreground">
            Configure leave categories and entitlements
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>All Leave Types ({types.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {types.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No leave types configured. Create one to enable leave requests.
                </p>
              </div>
            ) : (
              types.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{t.name}</p>
                        <Badge variant="outline" className="text-[10px] font-mono">{t.code}</Badge>
                        {!t.isPaid && (
                          <Badge variant="outline" className="text-[10px]">Unpaid</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.annualEntitlement} day{t.annualEntitlement !== 1 ? "s" : ""}/year
                        {!t.requiresApproval && " · Auto-approve"}
                      </p>
                    </div>
                  </div>
                  <form action={deleteLeaveTypeAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              New Leave Type
            </CardTitle>
            <CardDescription>e.g., Annual, Sick, Maternity</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createLeaveTypeAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" name="name" required minLength={2} placeholder="Annual Leave" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input id="code" name="code" required maxLength={4} placeholder="AL" className="font-mono uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="annualEntitlement" className="text-xs">Annual Entitlement (days)</Label>
                <Input id="annualEntitlement" name="annualEntitlement" type="number" min="0" defaultValue="20" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color" className="text-xs">Color</Label>
                <Input id="color" name="color" type="color" defaultValue="#6366f1" className="h-10" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPaid" name="isPaid" defaultChecked className="rounded" />
                <Label htmlFor="isPaid" className="text-xs cursor-pointer">Paid leave</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="requiresApproval" name="requiresApproval" defaultChecked className="rounded" />
                <Label htmlFor="requiresApproval" className="text-xs cursor-pointer">Requires approval</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Create Type
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
