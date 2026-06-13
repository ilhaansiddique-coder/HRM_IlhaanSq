import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPayslipsForEmployee } from "@/lib/services/hr/payroll.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, ArrowLeft, UserCircle } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/employee">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold">My Payslips</h1>
          <p className="text-xs text-muted-foreground">
            {employee.fullName} · {employee.empCode}
          </p>
        </div>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Monthly salary payments
          </CardTitle>
          <CardDescription>
            {slips.length} payslip{slips.length === 1 ? "" : "s"} on record
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {slips.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No payslips yet. They appear here once payroll is run for a
                month.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Extra duty</TableHead>
                      <TableHead className="text-right">Absent</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slips.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.month}</TableCell>
                        <TableCell className="text-right text-sm">
                          {fmt(s.gross, s.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {s.extraDutyDays > 0
                            ? `${s.extraDutyDays}d · ${fmt(s.extraDutyPayment, s.currency)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {s.absentDays > 0 ? `${s.absentDays}d` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-destructive">
                          {fmt(s.deductions, s.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {fmt(s.payable, s.currency)}
                        </TableCell>
                        <TableCell>
                          {s.paidAt ? (
                            <Badge variant="default" className="text-[10px]">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-3 md:hidden">
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
                      <Cell
                        label="Deductions"
                        v={fmt(s.deductions, s.currency)}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
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
