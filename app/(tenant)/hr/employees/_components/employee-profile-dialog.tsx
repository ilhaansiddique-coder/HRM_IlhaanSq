"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CalendarClock,
  CalendarDays,
  Coffee,
  Wallet,
  HandCoins,
  FileText,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Users,
} from "lucide-react";
import { getEmployeeProfileAction } from "../../actions";
import type { EmployeeProfile } from "@/lib/services/hr/employee-profile.service";

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "—";
}
function hm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function EmployeeProfileDialog({
  employeeId,
  onClose,
}: {
  employeeId: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!employeeId) {
      setProfile(null);
      return;
    }
    let active = true;
    setLoading(true);
    setErr(false);
    setProfile(null);
    getEmployeeProfileAction(employeeId)
      .then((p) => {
        if (!active) return;
        if (!p) setErr(true);
        else setProfile(p);
      })
      .catch(() => active && setErr(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [employeeId]);

  const cur = profile?.base.currency ?? "BDT";
  const money = (n: number) => `${cur} ${Math.round(n).toLocaleString()}`;

  return (
    <Dialog open={!!employeeId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="h-[780px] max-h-[90vh] w-[1150px] max-w-[95vw] overflow-y-auto">
        {loading || !profile ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            {err ? (
              <p className="text-sm">Couldn&apos;t load this employee&apos;s profile.</p>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Loading profile…</p>
              </>
            )}
            <DialogTitle className="sr-only">Employee details</DialogTitle>
            <DialogDescription className="sr-only">
              Loading employee profile
            </DialogDescription>
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="border-0 bg-transparent p-0 text-left backdrop-blur-none md:p-0">
              <DialogTitle className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(profile.base.fullName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg">
                    {profile.base.fullName}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {profile.base.empCode}
                    {profile.base.department ? ` · ${profile.base.department}` : ""}
                    {profile.base.position ? ` · ${profile.base.position}` : ""}
                  </span>
                </span>
                <Badge
                  variant={
                    profile.base.status === "active"
                      ? "default"
                      : profile.base.status === "terminated"
                        ? "destructive"
                        : "secondary"
                  }
                  className="ml-auto shrink-0 capitalize"
                >
                  {profile.base.status.replace("_", " ")}
                </Badge>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Employee details at a glance
              </DialogDescription>
            </DialogHeader>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Kpi
                icon={<CalendarClock className="h-4 w-4" />}
                label="On duty"
                value={`${profile.base.tenureDays.toLocaleString()} days`}
                hint={`Joined ${fmtDate(profile.base.hireDate)}`}
              />
              <Kpi
                icon={<UserCheck className="h-4 w-4" />}
                label="Present"
                value={profile.attendance.present}
                hint={`${profile.attendance.late} late · ${profile.attendance.absent} absent`}
                tone="success"
              />
              <Kpi
                icon={<CalendarDays className="h-4 w-4" />}
                label="Leave taken"
                value={`${profile.leave.approvedDays} d`}
                hint={`${profile.leave.approvedCount} approved · ${profile.leave.pendingCount} pending`}
              />
              <Kpi
                icon={<Coffee className="h-4 w-4" />}
                label="Breaks"
                value={profile.breaks.count}
                hint={hm(profile.breaks.totalMinutes)}
              />
              <Kpi
                icon={<Wallet className="h-4 w-4" />}
                label="Times paid"
                value={profile.payroll.paidCount}
                hint={`Total ${money(profile.payroll.totalPaid)}`}
              />
              <Kpi
                icon={<HandCoins className="h-4 w-4" />}
                label="Advances"
                value={profile.advances.count}
                hint={`Taken ${money(profile.advances.totalAmount)}`}
              />
              <Kpi
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Receivable"
                value={money(profile.advances.outstanding)}
                hint="Outstanding from employee"
                tone={profile.advances.outstanding > 0 ? "warning" : "default"}
              />
              <Kpi
                icon={<FileText className="h-4 w-4" />}
                label="Documents"
                value={profile.documents.count}
                hint={`${profile.documents.signed} signed${
                  profile.documents.expiringSoon
                    ? ` · ${profile.documents.expiringSoon} expiring`
                    : ""
                }`}
              />
            </div>

            {/* Detail sections */}
            <div className="grid gap-3 lg:grid-cols-3">
              <Panel icon={<CalendarClock className="h-4 w-4" />} title="Attendance">
                <Row label="Present" value={profile.attendance.present} />
                <Row label="Late" value={profile.attendance.late} />
                <Row label="Absent" value={profile.attendance.absent} />
                <Row label="Worked holiday" value={profile.attendance.holidayWorked} />
                <p className="pt-1 text-[11px] text-muted-foreground">
                  {fmtDate(profile.attendance.rangeStart)} – {fmtDate(profile.attendance.rangeEnd)}
                </p>
              </Panel>

              <Panel icon={<CalendarDays className="h-4 w-4" />} title="Leave">
                <Row label="Approved days" value={profile.leave.approvedDays} />
                <Row label="Approved requests" value={profile.leave.approvedCount} />
                <Row label="Pending requests" value={profile.leave.pendingCount} />
                <Row label="Pending days" value={profile.leave.pendingDays} />
              </Panel>

              <Panel icon={<Coffee className="h-4 w-4" />} title="Break time">
                <Row label="Sessions" value={profile.breaks.count} />
                <Row label="Total time" value={hm(profile.breaks.totalMinutes)} />
                <Row label="Penalty applied" value={money(profile.breaks.penaltyAppliedAmount)} />
                <Row label="Penalty pending" value={money(profile.breaks.penaltyPendingAmount)} />
              </Panel>

              <Panel icon={<Wallet className="h-4 w-4" />} title="Payroll">
                <Row label="Payslips" value={profile.payroll.payslipCount} />
                <Row label="Times paid" value={profile.payroll.paidCount} />
                <Row label="Total paid" value={money(profile.payroll.totalPaid)} />
                <Row
                  label="Last paid"
                  value={
                    profile.payroll.lastPaidAmount != null
                      ? `${money(profile.payroll.lastPaidAmount)}${
                          profile.payroll.lastPaidMonth
                            ? ` (${profile.payroll.lastPaidMonth})`
                            : ""
                        }`
                      : "—"
                  }
                />
              </Panel>

              <Panel icon={<HandCoins className="h-4 w-4" />} title="Advances">
                <Row label="Advances taken" value={profile.advances.count} />
                <Row label="Total amount" value={money(profile.advances.totalAmount)} />
                <Row label="Recovered" value={money(profile.advances.recovered)} />
                <Row
                  label="Outstanding (receivable)"
                  value={money(profile.advances.outstanding)}
                  highlight={profile.advances.outstanding > 0}
                />
              </Panel>

              <Panel icon={<Users className="h-4 w-4" />} title="Details">
                <Row label="Employment" value={profile.base.employmentType.replace("_", " ")} />
                <Row label="Reports to" value={profile.base.manager ?? "—"} />
                <Row label="Base salary" value={profile.base.baseSalary != null ? money(profile.base.baseSalary) : "—"} />
                <Row
                  label="Phone"
                  value={
                    profile.base.phone ? (
                      <a
                        href={`tel:${profile.base.phone}`}
                        className="text-primary hover:underline"
                        title="Call"
                      >
                        {profile.base.phone}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label="Email"
                  value={
                    <a
                      href={`mailto:${profile.base.email}`}
                      className="break-all text-primary hover:underline"
                      title="Send email"
                    >
                      {profile.base.email}
                    </a>
                  }
                />
              </Panel>
            </div>

            {/* Documents */}
            <Panel icon={<FileText className="h-4 w-4" />} title={`Documents (${profile.documents.count})`}>
              {profile.documents.items.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No documents attached.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {profile.documents.items.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {d.category ?? "Uncategorized"}
                          {d.expiresAt ? ` · expires ${fmtDate(d.expiresAt)}` : ""}
                        </p>
                      </div>
                      {d.isSigned && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      )}
                      {d.fileUrl && (
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Open document"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-right font-medium ${highlight ? "text-warning" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
