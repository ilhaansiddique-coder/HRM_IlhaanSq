"use client";

import { Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EditAdvanceDialog } from "./edit-advance-dialog";
import { cancelAdvanceAction } from "../../../actions-phase2";

export type AdvanceRow = {
  id: string;
  employeeName: string;
  employeeCode: string;
  reason: string | null;
  amount: number;
  installment: number;
  outstanding: number;
  recoveryScope: string;
  issuedAt: string; // ISO
  status: string;
};

const statusVariant = (
  s: string
): "default" | "secondary" | "outline" =>
  s === "active" ? "default" : s === "cleared" ? "secondary" : "outline";

export function AdvancesTable({ rows }: { rows: AdvanceRow[] }) {
  const columns: Column<AdvanceRow>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (a) => (
        <>
          <div className="font-medium">{a.employeeName}</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {a.employeeCode}
          </div>
          {a.reason && (
            <div className="text-[11px] text-muted-foreground">{a.reason}</div>
          )}
        </>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      headClassName: "text-right",
      className: "text-right",
      cell: (a) => a.amount.toLocaleString(),
    },
    {
      key: "installment",
      header: "Installment",
      headClassName: "text-right",
      className: "text-right",
      cell: (a) => a.installment.toLocaleString(),
    },
    {
      key: "scope",
      header: "Recovery scope",
      className: "text-xs text-muted-foreground",
      cell: (a) => a.recoveryScope,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      headClassName: "text-right",
      className: "text-right font-medium text-warning",
      cell: (a) => a.outstanding.toLocaleString(),
    },
    {
      key: "issued",
      header: "Issued",
      className: "text-xs text-muted-foreground",
      cell: (a) => new Date(a.issuedAt).toLocaleDateString(),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <Badge variant={statusVariant(a.status)} className="capitalize">
          {a.status}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(a) => a.id}
      itemNoun="advances"
      actionsCell={(a) =>
        a.status === "active" ? (
          <>
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
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      }
      onBulkDelete={async (ids) => {
        await Promise.all(
          ids.map((id) => {
            const fd = new FormData();
            fd.set("id", id);
            return cancelAdvanceAction(fd);
          })
        );
      }}
    />
  );
}
