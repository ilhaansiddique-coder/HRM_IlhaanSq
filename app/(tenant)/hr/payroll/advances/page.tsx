import { requireTenant } from "@/lib/auth";
import { listAdvances } from "@/lib/services/hr/payroll.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Ban, Wallet, Layers } from "lucide-react";
import { AdvanceDialog } from "./_components/advance-dialog";
import { EditAdvanceDialog } from "./_components/edit-advance-dialog";
import { AdvancesTable, type AdvanceRow } from "./_components/advances-table";
import { AdvanceLiveRefresh } from "../_components/advance-live-refresh";
import { cancelAdvanceAction } from "../../actions-phase2";
import { resolveDateBounds } from "@/lib/date-range";

export default async function AdvancesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();

  // Global top-bar date filter applies to advances (by issue date).
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");

  const [advances, employees] = await Promise.all([
    listAdvances(session.tenantId, {
      ...(start && { from: start }),
      ...(end && { to: end }),
    }),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const active = advances.filter((a) => a.status === "active");
  const totalOutstanding = active.reduce((s, a) => s + a.outstanding, 0);

  const mY = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  // Human-readable description of WHEN/over what period the installment is
  // recovered, so a 0 on the salary sheet for the current month is explained.
  const recoveryScope = (a: {
    installment: number;
    issuedAt: string;
    recoveryStart?: Date | string | null;
    recoveryEnd?: Date | string | null;
  }): string => {
    if (a.recoveryStart && a.recoveryEnd) {
      const s = new Date(a.recoveryStart);
      const e = new Date(a.recoveryEnd);
      return `${mY(s)} – ${mY(e)}`;
    }
    if (a.installment > 0) {
      const iss = new Date(a.issuedAt);
      const next = new Date(
        Date.UTC(iss.getUTCFullYear(), iss.getUTCMonth() + 1, 1)
      );
      return `From ${mY(next)}, monthly until cleared`;
    }
    return "Not scheduled";
  };

  const statusVariant = (s: string) =>
    s === "active" ? "default" : s === "cleared" ? "secondary" : "outline";

  const rows: AdvanceRow[] = advances.map((a) => ({
    id: a.id,
    employeeName: a.employee.fullName,
    employeeCode: a.employee.empCode,
    reason: a.reason ?? null,
    amount: a.amount,
    installment: a.installment,
    outstanding: a.outstanding,
    recoveryScope: recoveryScope(a),
    issuedAt: new Date(a.issuedAt).toISOString(),
    status: a.status,
  }));

  return (
    <div className="space-y-6">
      <AdvanceLiveRefresh tenantId={session.tenantId} />

      {/* The New Advance form opens from the "+" button in the top bar (left of
          the notification bell). Portals into the TopBar; nothing inline here. */}
      <AdvanceDialog
        employees={employees.map((e) => ({ id: e.id, name: e.fullName, code: e.empCode }))}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<HandCoins />}
          label="Active Advances"
          value={active.length}
          subtitle="Currently being recovered"
          tone="primary"
        />
        <StatCard
          icon={<Wallet />}
          label="Total Outstanding"
          value={totalOutstanding.toLocaleString()}
          subtitle="Across active advances"
          tone="warning"
          valueClassName="text-warning"
        />
        <StatCard
          icon={<Layers />}
          label="All Records"
          value={advances.length}
          subtitle="Lifetime advances"
          tone="info"
        />
      </div>

      <div className="space-y-3">
            {advances.length === 0 ? (
              <div className="text-center py-16">
                <HandCoins className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No advances recorded yet</p>
              </div>
            ) : (
              <>
              {/* Mobile / tablet: one card per advance (no horizontal scroll) */}
              <div className="space-y-3 md:hidden">
                {advances.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {a.employee.fullName}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {a.employee.empCode}
                        </div>
                      </div>
                      <Badge
                        variant={statusVariant(a.status)}
                        className="shrink-0 capitalize"
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                      <div className="text-muted-foreground">Amount</div>
                      <div className="text-right tabular-nums">
                        {a.amount.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground">Installment</div>
                      <div className="text-right tabular-nums">
                        {a.installment.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground">Outstanding</div>
                      <div className="text-right font-medium tabular-nums text-warning">
                        {a.outstanding.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground">Recovery scope</div>
                      <div className="text-right text-xs">{recoveryScope(a)}</div>
                      <div className="text-muted-foreground">Issued</div>
                      <div className="text-right text-xs">
                        {new Date(a.issuedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {a.reason && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {a.reason}
                      </div>
                    )}
                    {a.status === "active" && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/40 pt-2">
                        <EditAdvanceDialog
                          advance={{
                            id: a.id,
                            amount: a.amount,
                            installment: a.installment,
                            reason: a.reason ?? null,
                          }}
                        />
                        <form action={cancelAdvanceAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-destructive"
                            title="Cancel advance"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: the project-wide DataTable (no heading/border card). */}
              <div className="hidden md:block">
                <AdvancesTable rows={rows} />
              </div>
              </>
            )}
      </div>
    </div>
  );
}
