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
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Payroll Runs</h1>
          <p className="text-sm text-muted-foreground">{runs.length} run{runs.length !== 1 ? "s" : ""} executed</p>
        </div>
        <Link href="/hr/payroll/runs/new"><Button><Plus className="h-4 w-4" />Run Payroll</Button></Link>
      </div>

      <Card className="border-border/70 bg-card/80">
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
    </div>
  );
}
