"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

export type RunRow = {
  id: string;
  periodName: string;
  payDate: string;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: string;
  runAt: string;
};

export function PayrollRunsTable({ rows }: { rows: RunRow[] }) {
  const columns: Column<RunRow>[] = [
    {
      key: "period",
      header: "Period",
      className: "font-medium",
      cell: (r) => (
        <Link
          href={`/hr/payroll/runs/${r.id}`}
          className="text-primary hover:underline"
        >
          {r.periodName}
        </Link>
      ),
    },
    {
      key: "payDate",
      header: "Pay Date",
      className: "text-xs text-muted-foreground",
      cell: (r) => new Date(r.payDate).toLocaleDateString(),
    },
    {
      key: "employees",
      header: "Employees",
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => r.employeeCount,
    },
    {
      key: "gross",
      header: "Gross",
      headClassName: "text-right",
      className: "text-right font-medium",
      cell: (r) => Number(r.totalGross).toLocaleString(),
    },
    {
      key: "deductions",
      header: "Deductions",
      headClassName: "text-right",
      className: "text-right text-warning",
      cell: (r) => Number(r.totalDeductions).toLocaleString(),
    },
    {
      key: "net",
      header: "Net Pay",
      headClassName: "text-right",
      className: "text-right font-bold text-success",
      cell: (r) => Number(r.totalNet).toLocaleString(),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.status === "completed" ? "default" : "outline"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "runAt",
      header: "Run At",
      className: "text-xs text-muted-foreground",
      cell: (r) => new Date(r.runAt).toLocaleDateString(),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(r) => r.id}
      selectable={false}
      itemNoun="runs"
    />
  );
}
