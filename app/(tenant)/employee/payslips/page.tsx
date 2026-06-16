import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPayslipsForEmployee } from "@/lib/services/hr/payroll.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, UserCircle } from "lucide-react";
import { PayslipsTable, type PayslipRow } from "./_components/payslips-table";

export default async function EmployeePayslipsPage() {
  const session = await requireTenant();
  const employee = await prisma.employee.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId },
    select: { id: true, fullName: true, empCode: true },
  });

  if (!employee) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <UserCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-semibold">No employee profile linked</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact your administrator.
        </p>
      </div>
    );
  }

  const slips = await listPayslipsForEmployee(session.tenantId, employee.id);
  const fmt = (n: number, c: string) =>
    `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const rows: PayslipRow[] = slips.map((s) => ({
    id: s.id,
    month: s.month,
    currency: s.currency,
    gross: Number(s.gross),
    extraDutyDays: Number(s.extraDutyDays),
    extraDutyPayment: Number(s.extraDutyPayment),
    absentDays: Number(s.absentDays),
    deductions: Number(s.deductions),
    payable: Number(s.payable),
    paidAt: s.paidAt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold">My Payslips</h1>
          <p className="text-xs text-muted-foreground">
            {employee.fullName} · {employee.empCode}
          </p>
        </div>
      </div>

      {slips.length === 0 ? (
        <Card className="border-border/70 bg-card/80 py-12 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No payslips yet. They appear here once payroll is run for a month.
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop: the project-wide DataTable (read-only — no selection). */}
          <div className="hidden md:block">
            <PayslipsTable rows={rows} />
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {slips.map((s) => (
              <Card key={s.id} className="rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{s.month}</p>
                  {s.paidAt ? (
                    <Badge variant="default" className="text-[10px]">
                      Paid
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Pending
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                  <Cell label="Gross" v={fmt(s.gross, s.currency)} />
                  <Cell
                    label="Net pay"
                    v={fmt(s.payable, s.currency)}
                    strong
                  />
                  <Cell
                    label="Extra duty"
                    v={
                      s.extraDutyDays > 0
                        ? `${s.extraDutyDays}d · ${fmt(s.extraDutyPayment, s.currency)}`
                        : "—"
                    }
                  />
                  <Cell label="Deductions" v={fmt(s.deductions, s.currency)} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Cell({
  label,
  v,
  strong,
}: {
  label: string;
  v: string;
  strong?: boolean;
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={strong ? "font-semibold" : "font-medium"}>{v}</span>
    </div>
  );
}
