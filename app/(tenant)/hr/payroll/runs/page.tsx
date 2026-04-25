import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listPayrollRuns } from "@/lib/services/hr/payroll.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, ArrowLeft, FileText } from "lucide-react";

export default async function RunsPage() {
  const session = await requireTenant();
  const runs = await listPayrollRuns(session.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hr/payroll"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <Link href="/hr/payroll/runs/new"><Button><Plus className="h-4 w-4" />Run Payroll</Button></Link>
      </div>

      {/* Desktop: table view. Mobile uses the card stack below. */}
      <Card className="hidden md:block border-border/70 bg-card/80 rounded-lg">
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No payroll runs yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.period.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.period.payDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{r.employeeCount}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.totalGross).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-warning">{Number(r.totalDeductions).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-success">{Number(r.totalNet).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={r.status === "completed" ? "default" : "outline"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.runAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile: payroll run card stack — period + status header, pay-date
          and employee count, gross/deductions/net financials, run-at date. */}
      <div className="md:hidden space-y-3">
        {runs.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-40" />
            <span className="text-sm">No payroll runs yet</span>
          </Card>
        ) : (
          runs.map((r) => (
            <Card key={r.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{r.period.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pay date: {new Date(r.period.payDate).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={r.status === "completed" ? "default" : "outline"}
                  className="rounded-lg"
                >
                  {r.status}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2">
                  <span className="text-muted-foreground">Employees: </span>
                  <span className="font-semibold">{r.employeeCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Gross: </span>
                  <span className="font-medium">
                    {Number(r.totalGross).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Deductions: </span>
                  <span className="font-medium text-warning">
                    {Number(r.totalDeductions).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Net Pay: </span>
                  <span className="font-bold text-success">
                    {Number(r.totalNet).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 text-muted-foreground">
                  Run at: {new Date(r.runAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
