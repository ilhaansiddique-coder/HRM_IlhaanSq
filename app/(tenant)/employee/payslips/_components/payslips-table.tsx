"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

export type PayslipRow = {
  id: string;
  month: string;
  currency: string;
  gross: number;
  extraDutyDays: number;
  extraDutyPayment: number;
  absentDays: number;
  deductions: number;
  payable: number;
  paidAt: string | null;
};

const fmt = (n: number, c: string) =>
  `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function PayslipsTable({ rows }: { rows: PayslipRow[] }) {
  const columns: Column<PayslipRow>[] = [
    {
      key: "month",
      header: "Month",
      className: "font-medium",
      cell: (r) => r.month,
    },
    {
      key: "gross",
      header: "Gross",
      headClassName: "text-right",
      className: "text-right text-sm",
      cell: (r) => fmt(r.gross, r.currency),
    },
    {
      key: "extraDuty",
      header: "Extra duty",
      headClassName: "text-right",
      className: "text-right text-sm",
      cell: (r) =>
        r.extraDutyDays > 0
          ? `${r.extraDutyDays}d · ${fmt(r.extraDutyPayment, r.currency)}`
          : "—",
    },
    {
      key: "absent",
      header: "Absent",
      headClassName: "text-right",
      className: "text-right text-sm",
      cell: (r) => (r.absentDays > 0 ? `${r.absentDays}d` : "—"),
    },
    {
      key: "deductions",
      header: "Deductions",
      headClassName: "text-right",
      className: "text-right text-sm text-destructive",
      cell: (r) => fmt(r.deductions, r.currency),
    },
    {
      key: "net",
      header: "Net pay",
      headClassName: "text-right",
      className: "text-right text-sm font-semibold",
      cell: (r) => fmt(r.payable, r.currency),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) =>
        r.paidAt ? (
          <Badge variant="default" className="text-[10px]">
            Paid
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Pending
          </Badge>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(r) => r.id}
      selectable={false}
      itemNoun="payslips"
    />
  );
}