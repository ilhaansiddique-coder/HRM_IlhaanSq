import { requireTenant } from "@/lib/auth";
import { listAttendance, getAttendanceStats } from "@/lib/services/hr/attendance.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
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
import { CalendarClock, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { CheckInOutPanel } from "./_components/check-in-out-panel";

export default async function AttendancePage() {
  const session = await requireTenant();
  const [records, stats, employees] = await Promise.all([
    listAttendance(session.tenantId),
    getAttendanceStats(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Present Today"
          value={stats.present}
          variant="success"
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          title="Absent Today"
          value={stats.absent}
          variant="warning"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Attendance Rate"
          value={`${stats.attendanceRate}%`}
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          title="Active Workforce"
          value={stats.totalActive}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {/* Desktop: table view. Mobile uses the card stack below. */}
          <Card className="hidden md:block border-border/70 bg-card/80 rounded-lg">
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>This month, latest first</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No attendance records yet. Use the panel to check in/out.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{r.employee.fullName}</p>
                              <p className="text-xs text-muted-foreground font-mono">{r.employee.empCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(r.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {r.workHours ? Number(r.workHours).toFixed(1) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {r.status.replace("_", " ")}
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

          {/* Mobile: attendance card stack — employee + status header,
              date, check-in/out times, hours. */}
          <div className="md:hidden space-y-3">
            <div>
              <p className="text-base font-semibold">Attendance Records</p>
              <p className="text-xs text-muted-foreground">
                This month, latest first
              </p>
            </div>
            {records.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <CalendarClock className="h-10 w-10 opacity-40" />
                <span className="text-sm">
                  No attendance records yet. Use the panel to check in/out.
                </span>
              </Card>
            ) : (
              records.map((r) => (
                <Card key={r.id} className="rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">
                        {r.employee.fullName}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {r.employee.empCode}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-lg capitalize text-xs"
                    >
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Date: </span>
                      <span className="font-medium">
                        {new Date(r.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-in: </span>
                      <span className="font-mono font-medium">
                        {r.checkIn
                          ? new Date(r.checkIn).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-out: </span>
                      <span className="font-mono font-medium">
                        {r.checkOut
                          ? new Date(r.checkOut).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Hours: </span>
                      <span className="font-semibold">
                        {r.workHours ? Number(r.workHours).toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Quick Check-in/Out
            </CardTitle>
            <CardDescription>Record attendance for today</CardDescription>
          </CardHeader>
          <CardContent>
            <CheckInOutPanel
              employees={employees.map((e) => ({ id: e.id, name: e.fullName, code: e.empCode }))}
            />
          </CardContent>
        </Card>
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
  icon: React.ReactNode;
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
