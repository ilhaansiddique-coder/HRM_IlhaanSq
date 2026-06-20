import type { ReactNode } from "react";
import { requireTenant } from "@/lib/auth";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  listBreakSessions,
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
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Coffee, Clock, Timer, UserCheck } from "lucide-react";
import { BreakStartEndPanel } from "./_components/break-start-end-panel";
import { LogBreakForm } from "./_components/log-break-form";
import { BreakThresholdForm } from "./_components/break-threshold-form";
import {
  BreakSessionsTable,
  type BreakSessionRow,
} from "./_components/break-sessions-table";
import { resolveDateBounds } from "@/lib/date-range";

export default async function BreakTimePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();
  const isAdmin = ["owner", "admin", "superadmin"].includes(session.role ?? "");

  // Top-bar date filter (defaults to all-time so the full history shows).
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");
  const rangeFilter = {
    ...(start && { from: start }),
    ...(end && { to: end }),
  };

  // The logged-in user's own employee record (if any) — used for THEIR personal
  // Start/End break button. Looked up for every role so admins can take breaks
  // too, not just employees.
  const myEmployee = await prisma.employee.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
    select: { id: true },
  });
  const myEmployeeId = myEmployee?.id;

  // Non-admins only ever see their own data; admins see everyone's. When a
  // non-admin has no linked employee record, filter by a zero UUID so the
  // queries return nothing (employeeId is a UUID column — a non-UUID sentinel
  // would crash Prisma).
  const NO_MATCH = "00000000-0000-0000-0000-000000000000";
  const dataFilter = isAdmin
    ? { ...rangeFilter }
    : { employeeId: myEmployeeId ?? NO_MATCH, ...rangeFilter };

  const [stats, sessions, employees, threshold, activeBreak] =
    await Promise.all([
      getBreakStats(session.tenantId, { from: start, to: end }),
      listBreakSessions(session.tenantId, dataFilter),
      listEmployees(session.tenantId, { status: "active" }),
      getBreakTimeThreshold(session.tenantId),
      myEmployeeId ? getActiveBreak(session.tenantId, myEmployeeId) : null,
    ]);

  // Plain serializable rows for the shared DataTable (both admin & employee
  // branches render the same shape).
  const breakRows: BreakSessionRow[] = sessions.map((s) => ({
    id: s.id,
    employeeName: s.employee.fullName,
    empCode: s.employee.empCode,
    breakStart: s.breakStart.toISOString(),
    breakEnd: s.breakEnd ? s.breakEnd.toISOString() : null,
    durationMin: s.durationMin,
    isDuty: s.isDuty,
    notes: s.notes,
    status: s.status,
  }));

  // Reusable personal Start/End break card for the logged-in user.
  const myBreakCard = (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-primary" />
          Break Time
        </CardTitle>
        <CardDescription>
          Press start to begin your break; press again to end it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {myEmployeeId ? (
          <BreakStartEndPanel
            employeeId={myEmployeeId}
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Your account isn&apos;t linked to an employee record, so a personal
            break can&apos;t be tracked here. Ask an admin to link your account
            to an employee profile.
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Employee view: the Start/End button, a quick summary, and a history table
  // so they can see how often and how long they take breaks.
  if (!isAdmin) {
    const completed = sessions.filter((s) => s.status === "completed");
    const totalMin = Math.round(
      completed.reduce((sum, s) => sum + s.durationMin, 0)
    );
    const avgMin = completed.length
      ? Math.round(totalMin / completed.length)
      : 0;

    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="mx-auto w-full max-w-md">{myBreakCard}</div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Breaks taken", value: completed.length },
            { label: "Total time", value: `${totalMin} min` },
            { label: "Avg per break", value: `${avgMin} min` },
          ].map((stat) => (
            <MetricCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              valueClassName="tabular-nums"
            />
          ))}
        </div>

        <div>
          <div className="mb-3">
            <p className="text-base font-semibold">Your Break History</p>
            <p className="text-xs text-muted-foreground">
              Every break you&apos;ve taken
            </p>
          </div>
          <BreakSessionsTable rows={breakRows} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row — at the top. */}
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
            title={start || end ? "Completed" : "Completed (all time)"}
            value={stats.completed}
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

      {/* Log Break (left, 40%) + personal Break Time (right, 60%). */}
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Log Break
            </CardTitle>
            <CardDescription>
              Record a break for a specific window — from one time to another.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogBreakForm
              employees={employees.map((e) => ({
                id: e.id,
                name: e.fullName,
                code: e.empCode,
              }))}
            />
          </CardContent>
        </Card>
        {myBreakCard}
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

      <div className="space-y-3">
          {/* Desktop: the project-wide DataTable (read-only — no selection).
              Mobile uses the card stack below. */}
          <div className="hidden md:block">
            <BreakSessionsTable rows={breakRows} showEmployee />
          </div>

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
  return (
    <MetricCard
      icon={icon}
      label={title}
      value={typeof value === "number" ? value.toLocaleString() : value}
      tone={
        variant === "success"
          ? "success"
          : variant === "warning"
          ? "warning"
          : "primary"
      }
    />
  );
}

