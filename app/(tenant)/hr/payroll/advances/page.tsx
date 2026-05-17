import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listAdvances } from "@/lib/services/hr/payroll.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, HandCoins, Plus, Ban } from "lucide-react";
import { AdvanceForm } from "./_components/advance-form";
import { EditAdvanceDialog } from "./_components/edit-advance-dialog";
import { AdvanceLiveRefresh } from "../_components/advance-live-refresh";
import { cancelAdvanceAction } from "../../actions-phase2";

export default async function AdvancesPage() {
  const session = await requireTenant();
  const [advances, employees] = await Promise.all([
    listAdvances(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const active = advances.filter((a) => a.status === "active");
  const totalOutstanding = active.reduce((s, a) => s + a.outstanding, 0);

  const statusVariant = (s: string) =>
    s === "active" ? "default" : s === "cleared" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <AdvanceLiveRefresh tenantId={session.tenantId} />
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Advances</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{active.length}</div></CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Outstanding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-warning">{totalOutstanding.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">All Records</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{advances.length}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-primary" />
              Employee Advances
            </CardTitle>
            <CardDescription>
              Recovered automatically on payroll runs until cleared
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {advances.length === 0 ? (
              <div className="text-center py-16">
                <HandCoins className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No advances recorded yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Installment</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.employee.fullName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {a.employee.empCode}
                        </div>
                        {a.reason && (
                          <div className="text-[11px] text-muted-foreground">{a.reason}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{a.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{a.installment.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-warning">
                        {a.outstanding.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.issuedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(a.status)} className="capitalize">
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === "active" && (
                          <div className="flex items-center justify-end gap-1">
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
                                className="h-7 w-7 text-destructive"
                                title="Cancel advance"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              New Advance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdvanceForm
              employees={employees.map((e) => ({
                id: e.id,
                name: e.fullName,
                code: e.empCode,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
