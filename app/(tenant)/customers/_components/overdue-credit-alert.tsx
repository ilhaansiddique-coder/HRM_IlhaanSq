"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrency } from "../../_components/providers";

type OverdueRow = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string | null;
  daysOverdue: number;
  createdAt: string;
};

// Banner rendered at the top of /customers when any credit invoice is
// past its due_date with amount_due > 0. Collapsed by default to a
// compact summary; expand to see the per-invoice breakdown. Server
// fetches the data via getOverdueCreditSales and passes it in.
export function OverdueCreditAlert({ rows }: { rows: OverdueRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const { formatAmount } = useCurrency();

  if (rows.length === 0) return null;

  const totalDue = rows.reduce((s, r) => s + r.amountDue, 0);
  const oldest = rows.reduce(
    (m, r) => (r.daysOverdue > m ? r.daysOverdue : m),
    0
  );
  const customerCount = new Set(rows.map((r) => r.customerId).filter(Boolean))
    .size;

  return (
    <Card className="border-amber-500/40 bg-amber-500/10">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {rows.length} overdue credit invoice
              {rows.length === 1 ? "" : "s"} ·{" "}
              {formatAmount(totalDue)} owed by {customerCount} customer
              {customerCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              Oldest is {oldest} day{oldest === 1 ? "" : "s"} past due.
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-500/30 p-3 space-y-1.5">
          {rows.slice(0, 20).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md bg-background/50 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.customerName}</p>
                <p className="text-muted-foreground">
                  {r.invoiceNumber}
                  {r.customerPhone && ` · ${r.customerPhone}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  {formatAmount(r.amountDue)}
                </p>
                <p className="text-muted-foreground">
                  {r.daysOverdue}d overdue
                </p>
              </div>
            </div>
          ))}
          {rows.length > 20 && (
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              + {rows.length - 20} more …
            </p>
          )}
          <div className="pt-1 text-right">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
            >
              Collapse
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
