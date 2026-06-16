import { requireTenant } from "@/lib/auth";
import { listLeaveTypes } from "@/lib/services/hr/leave.service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Trash2 } from "lucide-react";
import { deleteLeaveTypeAction } from "../../hr/actions";
import { NewLeaveTypeDialog } from "../../hr/leave/types/_components/new-leave-type-dialog";

// Manage Leave Types, surfaced as a System Settings section. Admins create and
// remove the leave types that drive leave requests (the "+" portals into the
// top bar while this section is mounted).
export async function LeaveTypesSection() {
  const session = await requireTenant();
  const types = await listLeaveTypes(session.tenantId);

  return (
    <>
      {/* The New Leave Type form opens from the "+" button in the top bar (left
          of the notification bell). Portals into the TopBar; nothing inline. */}
      <NewLeaveTypeDialog />

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
                  <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
