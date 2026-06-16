import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
import { StatCard as MetricCard, type StatTone } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { LeaveActions } from "./_components/leave-actions";
import { SubmitLeaveDialog } from "./_components/submit-leave-dialog";
import { resolveDateBounds } from "@/lib/date-range";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();
  const isAdmin = ["owner", "admin", "superadmin"].includes(session.role ?? "");

  // Global top-bar date filter (by leave-request date; "all time" = no bound).
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");

  // The logged-in user's own employee record (if any). Non-admins only ever see
  // and file leave for THEMSELVES, so we scope every query to this record — the
  // same role-aware pattern the Break page uses.
  const myEmployee = await prisma.employee.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
    select: { id: true, fullName: true, empCode: true },
  });
  const myEmployeeId = myEmployee?.id;

  // When a non-admin has no linked employee record, filter by a zero UUID so the
  // queries return nothing (employeeId is a UUID column — a non-UUID sentinel
  // would crash Prisma).
  const NO_MATCH = "00000000-0000-0000-0000-000000000000";
  const dateFilter = {
    ...(start && { from: start }),
    ...(end && { to: end }),
  };
  const dataFilter = isAdmin
    ? { ...dateFilter }
    : { employeeId: myEmployeeId ?? NO_MATCH, ...dateFilter };

  const [requests, types, employees] = await Promise.all([
    listLeaveRequests(session.tenantId, dataFilter),
    listLeaveTypes(session.tenantId),
    // The employee picker is only used by admins; employees auto-target self.
    isAdmin
      ? listEmployees(session.tenantId, { status: "active" })
      : Promise.resolve([]),
  ]);

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const rejected = requests.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-6">
      {/* Submit Leave Request opens from the "+" button in the top bar (left of
          the notification bell). Manage Leave Types now lives in Settings.
          Admins pick any employee; employees file for themselves. */}
      <SubmitLeaveDialog
        isAdmin={isAdmin}
        employees={employees.map((e) => ({ id: e.id, name: e.fullName, code: e.empCode }))}
        selfEmployee={
          !isAdmin && myEmployee
            ? { id: myEmployee.id, name: myEmployee.fullName, code: myEmployee.empCode }
            : null
        }
        types={types.map((t) => ({ id: t.id, name: t.name, code: t.code }))}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" count={pending.length} variant="warning" />
        <StatCard label="Approved" count={approved.length} variant="success" />
        <StatCard label="Rejected" count={rejected.length} variant="muted" />
      </div>

      <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>{isAdmin ? "Leave Requests" : "My Leave Requests"}</CardTitle>
            <CardDescription>
              {isAdmin ? "All requests in your workspace" : "Leave you've requested"}
            </CardDescription>
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
                            {isAdmin && r.status === "pending" && (
                              <LeaveActions requestId={r.id} />
                            )}
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
  const map: Record<
    "success" | "warning" | "muted",
    { tone: StatTone; icon: ReactNode }
  > = {
    success: { tone: "success", icon: <CheckCircle2 /> },
    warning: { tone: "warning", icon: <Clock /> },
    muted: { tone: "destructive", icon: <XCircle /> },
  };
  const { tone, icon } = map[variant];
  return <MetricCard label={label} value={count} tone={tone} icon={icon} />;
}
