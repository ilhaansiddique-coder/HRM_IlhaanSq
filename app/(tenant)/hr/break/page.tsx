import type { ReactNode } from "react";
import { requireTenant } from "@/lib/auth";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  listBreakSessions,
  listBreakPenalties,
  getBreakStats,
  getActiveBreak,
  getBreakTimeThreshold,
} from "@/lib/services/hr/break.service";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coffee,
  Clock,
  Timer,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { BreakStartEndPanel } from "./_components/break-start-end-panel";
import { PenaltyForm } from "./_components/penalty-form";
import { PenaltyList } from "./_components/penalty-list";
import { BreakThresholdForm } from "./_components/break-threshold-form";

export default async function BreakTimePage() {
  const session = await requireTenant();
  const isAdmin = ["owner", "admin", "superadmin"].includes(session.role ?? "");

  const employee = isAdmin
    ? null
    : await prisma.employee.findFirst({
        where: { tenantId: session.tenantId, userId: session.userId },
        select: { id: true },
      });

  const employeeId = isAdmin ? undefined : employee?.id;

  const [stats, sessions, penalties, employees, threshold, activeBreak] =
    await Promise.all([
      getBreakStats(session.tenantId),
      listBreakSessions(session.tenantId, employeeId ? { employeeId } : {}),
      listBreakPenalties(session.tenantId, employeeId ? { employeeId } : {}),
      listEmployees(session.tenantId, { status: "active" }),
      getBreakTimeThreshold(session.tenantId),
      employeeId ? getActiveBreak(session.tenantId, employeeId) : null,
    ]);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory xl:grid xl:grid-cols-4 xl:overflow-visible">
        <div className="w-[68vw] max-w-[300px] xl:w-auto xl:max-w-none shrink-0 snap-start">
          <StatCard
            icon={<Coffee className="h-4 w-4" />}
            title="On Break Now"
            value={stats.activeBreaks}
            variant="warning"
          />
        </div>
        <div className="w-[68vw] max-w-[300px] xl:w-auto xl:max-w-none shrink-0 snap-start">
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            title="Completed Today"
            value={stats.completedToday}
            variant="success"
          />
        </div>
        <div className="w-[68vw] max-w-[300px] xl:w-auto xl:max-w-none shrink-0 snap-start">
          <StatCard
            icon={<Timer className="h-4 w-4" />}
            title="Avg Duration (min)"
            value={stats.avgDurationMin}
          />
        </div>
        <div className="w-[68vw] max-w-[300px] xl:w-auto xl:max-w-none shrink-0 snap-start">
          <StatCard
            icon={<UserCheck className="h-4 w-4" />}
            title="Active Workforce"
            value={stats.totalEmployees}
          />
        </div>
      </div>

      {isAdmin && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakThresholdForm defaultValue={threshold} />
          </CardContent>
        </Card>
      )}

      <div
        className={
          isAdmin ? "grid gap-6 lg:grid-cols-[1fr_360px]" : "space-y-6"
        }
      >
        <div className="space-y-3">
          {!isAdmin && employeeId && (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-primary" />
                  Break Time
                </CardTitle>
                <CardDescription>Start or end your break</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakStartEndPanel
                  employeeId={employeeId}
                  thresholdMin={threshold}
                  activeBreak={
                    activeBreak
                      ? {
                          id: activeBreak.id,
                          breakStart: activeBreak.breakStart.toISOString(),
                          breakCategory: activeBreak.breakCategory,
                          notes: activeBreak.notes,
                        }
                      : null
                  }
                />
              </CardContent>
            </Card>
          )}
          <Card className="hidden md:block border-border/70 bg-card/80 rounded-lg">
            <CardHeader>
              <CardTitle>Break Sessions</CardTitle>
              <CardDescription>
                {isAdmin ? "All employees' breaks" : "Your break history"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <div className="text-center py-12">
                  <Coffee className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No break sessions recorded yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{s.employee.fullName}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {s.employee.empCode}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {new Date(s.breakStart).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            <span className="text-muted-foreground">
                              {new Date(s.breakStart).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {s.breakEnd
                              ? new Date(s.breakEnd).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {s.durationMin > 0
                              ? `${Math.round(s.durationMin)} min`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={s.isDuty ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {s.isDuty
                                ? "Courier · duty"
                                : "Personal · out of duty"}
                            </Badge>
                            {s.notes ? (
                              <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground">
                                {s.notes}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={s.status === "active" ? "secondary" : "outline"}
                              className="capitalize text-xs"
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="md:hidden space-y-3">
            <div>
              <p className="text-base font-semibold">Break Sessions</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "All employees' breaks" : "Your break history"}
              </p>
            </div>
            {sessions.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Coffee className="h-10 w-10 opacity-40" />
                <span className="text-sm">No break sessions recorded yet.</span>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sessions.map((s) => (
                <Card key={s.id} className="rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">
                        {s.employee.fullName}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {s.employee.empCode}
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "active" ? "secondary" : "outline"}
                      className="rounded-lg capitalize text-xs"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Start: </span>
                      <span className="font-mono font-medium">
                        {new Date(s.breakStart).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-mono font-medium">
                        {s.breakEnd
                          ? new Date(s.breakEnd).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration: </span>
                      <span className="font-semibold">
                        {s.durationMin > 0 ? `${Math.round(s.durationMin)} min` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="font-medium">
                        {new Date(s.breakStart).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant={s.isDuty ? "default" : "secondary"}
                      className="rounded-lg text-[11px]"
                    >
                      {s.isDuty
                        ? "Courier · duty"
                        : "Personal · out of duty"}
                    </Badge>
                    {s.notes ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span className="text-muted-foreground/70">
                          Reason:{" "}
                        </span>
                        {s.notes}
                      </p>
                    ) : null}
                  </div>
                </Card>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Break Penalties
                </CardTitle>
                <CardDescription>All penalty records</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending">
                  <TabsList>
                    <TabsTrigger value="pending">
                      Pending ({penalties.filter((p) => p.status === "pending").length})
                    </TabsTrigger>
                    <TabsTrigger value="applied">
                      Applied ({penalties.filter((p) => p.status === "applied").length})
                    </TabsTrigger>
                    <TabsTrigger value="waived">
                      Waived ({penalties.filter((p) => p.status === "waived").length})
                    </TabsTrigger>
                  </TabsList>
                  {(["pending", "applied", "waived"] as const).map((status) => (
                    <TabsContent key={status} value={status} className="mt-4">
                      <PenaltyList
                        penalties={
                          penalties
                            .filter((p) => p.status === status)
                            .map((p) => ({
                              ...p,
                              amount: Number(p.amount),
                            })) as any
                        }
                        isAdmin={true}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}

          {!isAdmin && penalties.length > 0 && (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Your Penalties</CardTitle>
                <CardDescription>Break time penalties</CardDescription>
              </CardHeader>
              <CardContent>
                <PenaltyList
                  penalties={penalties
                    .filter((p) => p.status !== "waived")
                    .map((p) => ({ ...p, amount: Number(p.amount) })) as any}
                  isAdmin={false}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {isAdmin && (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Add Penalty
                </CardTitle>
                <CardDescription>
                  Penalize employees for exceeding break time (threshold: {threshold} min)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PenaltyForm
                  employees={employees.map((e) => ({
                    id: e.id,
                    name: e.fullName,
                    code: e.empCode,
                  }))}
                  breakSessions={sessions.map((s) => ({
                    id: s.id,
                    employeeId: s.employeeId,
                    breakStart: s.breakStart.toISOString(),
                    durationMin: s.durationMin,
                  }))}
                  thresholdMin={threshold}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  variant = "default",
}: {
  icon: ReactNode;
  title: string;
  value: number | string;
  variant?: "default" | "success" | "warning";
}) {
  const iconBg =
    variant === "success"
      ? "bg-success/10 text-success"
      : variant === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-start gap-2 pb-2">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}
        >
          {icon}
        </div>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
