import { requireTenant } from "@/lib/auth";
import { listLeaveRequests, listLeaveTypes } from "@/lib/services/hr/leave.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays } from "lucide-react";
import { LeaveActions } from "./_components/leave-actions";
import { SubmitLeaveDialog } from "./_components/submit-leave-dialog";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export default async function LeavePage() {
  const session = await requireTenant();
  const [requests, types, employees] = await Promise.all([
    listLeaveRequests(session.tenantId),
    listLeaveTypes(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const rejected = requests.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-6">
      {/* Submit Leave Request opens from the "+" button in the top bar (left of
          the notification bell). Manage Leave Types is now in the sidebar. */}
      <SubmitLeaveDialog
        employees={employees.map((e) => ({ id: e.id, name: e.fullName, code: e.empCode }))}
        types={types.map((t) => ({ id: t.id, name: t.name, code: t.code }))}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" count={pending.length} variant="warning" />
        <StatCard label="Approved" count={approved.length} variant="success" />
        <StatCard label="Rejected" count={rejected.length} variant="muted" />
      </div>

      <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>All requests in your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
              </TabsList>

              {(["pending", "approved", "rejected"] as const).map((status) => (
                <TabsContent key={status} value={status} className="mt-4 space-y-2">
                  {requests.filter((r) => r.status === status).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No {status} requests</p>
                    </div>
                  ) : (
                    requests
                      .filter((r) => r.status === status)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border border-border/60 bg-background/40 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium">{r.employee.fullName}</p>
                                <Badge
                                  variant="outline"
                                  style={{ borderColor: r.leaveType.color, color: r.leaveType.color }}
                                  className="text-[10px]"
                                >
                                  {r.leaveType.name}
                                </Badge>
                                <Badge variant={statusVariants[r.status]} className="text-[10px]">
                                  {r.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(r.startDate).toLocaleDateString()} →{" "}
                                {new Date(r.endDate).toLocaleDateString()} · {r.days} day
                                {r.days !== 1 ? "s" : ""}
                              </p>
                              {r.reason && (
                                <p className="text-xs italic text-muted-foreground mt-1.5">
                                  &ldquo;{r.reason}&rdquo;
                                </p>
                              )}
                              {r.rejectionReason && (
                                <p className="text-xs text-destructive mt-1.5">
                                  Rejected: {r.rejectionReason}
                                </p>
                              )}
                            </div>
                            {r.status === "pending" && <LeaveActions requestId={r.id} />}
                          </div>
                        </div>
                      ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
    </div>
  );
}

function StatCard({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "success" | "warning" | "muted";
}) {
  const colors = {
    success: "border-success/35 text-success",
    warning: "border-warning/35 text-warning",
    muted: "border-border/70 text-muted-foreground",
  };
  return (
    <Card className={`${colors[variant]} bg-card/80`}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className="text-3xl font-bold">{count}</CardTitle>
      </CardHeader>
    </Card>
  );
}
