"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrency } from "../../_components/providers";
import type { SerializedSaleRow } from "./sales-list";

// One row inside a bucket column: the customer who contributed this
// amount, their courier (used as a subtitle, or em-dash when null),
// and the amount itself.
type BucketRow = {
  id: string;
  customer: string;
  courier: string | null;
  amount: number;
};

// Aggregates the filtered sales into the four payment buckets the panel
// renders. Mirrors the categorisation used by the page-level KPI strip
// so the column totals here always sum to the same Total Revenue
// number on the page.
//
//   COD (Due)  — amountDue for sales paid on delivery (one row per sale)
//   Credit     — amountDue for credit-term sales (one row per sale)
//   Cash       — cash payment splits (or fallback to amountPaid when
//                paymentMethod looks like "cash" and there are no splits)
//   Online     — every other split, sub-grouped by the split's `method`
//                (Bkash / Nagad / Bank Transfer / etc.) so the column
//                shows a "Bkash → ৳1,000" sub-header above its rows
//
// Cancelled sales contribute zero to every bucket. A single Mixed sale
// can contribute to multiple buckets — e.g. a COD sale with a partial
// Bkash deposit lands in BOTH the COD column (amountDue) AND the Online
// column (the deposit), which is the desired behaviour.
function aggregate(sales: SerializedSaleRow[]) {
  const cod: BucketRow[] = [];
  const credit: BucketRow[] = [];
  const cash: BucketRow[] = [];
  const onlineByMethod = new Map<string, BucketRow[]>();

  for (const sale of sales) {
    if (sale.paymentStatus === "cancelled") continue;

    if (sale.paymentTerms === "cod" && sale.amountDue > 0) {
      cod.push({
        id: `cod-${sale.id}`,
        customer: sale.customerName,
        courier: sale.courierName,
        amount: sale.amountDue,
      });
    }

    if (sale.paymentTerms === "credit" && sale.amountDue > 0) {
      credit.push({
        id: `credit-${sale.id}`,
        customer: sale.customerName,
        courier: sale.courierName,
        amount: sale.amountDue,
      });
    }

    if (sale.payments.length > 0) {
      // Per-split iteration so a sale split across Bkash + Nagad shows
      // under both methods. Skip zero-amount splits.
      let splitIdx = 0;
      for (const p of sale.payments) {
        if (p.amount <= 0) {
          splitIdx += 1;
          continue;
        }
        const isCash = p.method.toLowerCase().includes("cash");
        const row: BucketRow = {
          id: `${isCash ? "cash" : "online"}-${sale.id}-${splitIdx}`,
          customer: sale.customerName,
          courier: sale.courierName,
          amount: p.amount,
        };
        if (isCash) {
          cash.push(row);
        } else {
          const list = onlineByMethod.get(p.method) ?? [];
          list.push(row);
          onlineByMethod.set(p.method, list);
        }
        splitIdx += 1;
      }
    } else if (sale.amountPaid > 0) {
      // Legacy / single-payment fallback: classify the whole amountPaid
      // by the sale's default paymentMethod field.
      const isCash = sale.paymentMethod.toLowerCase().includes("cash");
      const row: BucketRow = {
        id: `${isCash ? "cash" : "online"}-${sale.id}`,
        customer: sale.customerName,
        courier: sale.courierName,
        amount: sale.amountPaid,
      };
      if (isCash) {
        cash.push(row);
      } else {
        const method = sale.paymentMethod || "Online";
        const list = onlineByMethod.get(method) ?? [];
        list.push(row);
        onlineByMethod.set(method, list);
      }
    }
  }

  const sumRows = (rs: BucketRow[]) => rs.reduce((s, r) => s + r.amount, 0);
  const codTotal = sumRows(cod);
  const creditTotal = sumRows(credit);
  const cashTotal = sumRows(cash);
  // Stable iteration order for the sub-method headers — alphabetical
  // by method label, otherwise the order shifts as splits arrive in
  // different orders across renders.
  const onlineGroups = Array.from(onlineByMethod.entries())
    .map(([method, rows]) => ({ method, rows, total: sumRows(rows) }))
    .sort((a, b) => a.method.localeCompare(b.method));
  const onlineTotal = onlineGroups.reduce((s, g) => s + g.total, 0);

  return {
    cod,
    credit,
    cash,
    onlineGroups,
    codTotal,
    creditTotal,
    cashTotal,
    onlineTotal,
  };
}

export function SalesHistoryPanel({
  sales,
  dateLabel,
}: {
  sales: SerializedSaleRow[];
  // Pre-formatted label for the header strip. Follows the toolbar's
  // current date filter so the panel and the list share one date scope.
  dateLabel: string;
}) {
  const { formatAmount } = useCurrency();
  const [open, setOpen] = useState(true);

  const data = useMemo(() => aggregate(sales), [sales]);

  // Header counter: count and gross of sales whose courier reported a
  // delivered status. Independent of the body breakdown, which always
  // covers the full filtered slice.
  const delivered = useMemo(() => {
    let count = 0;
    let gross = 0;
    for (const s of sales) {
      if (s.paymentStatus === "cancelled") continue;
      if (s.courierStatus === "delivered") {
        count += 1;
        gross += s.grandTotal;
      }
    }
    return { count, gross };
  }, [sales]);

  return (
    <Card className="overflow-hidden rounded-lg">
      {/* Header strip — clickable to toggle the body. Wrapped in a
          <button> so keyboard users get the same affordance and it
          shows up in the accessibility tree. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Package className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Delivered Orders</p>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="text-right leading-tight">
          <p className="text-base font-semibold tabular-nums">
            {delivered.count}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {formatAmount(delivered.gross)}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-px border-t border-border/60 bg-border/60 lg:grid-cols-4">
          <BucketColumn
            label="COD (Due)"
            total={formatAmount(data.codTotal)}
            rows={data.cod}
            formatAmount={formatAmount}
          />
          <BucketColumn
            label="Online"
            total={formatAmount(data.onlineTotal)}
            groups={data.onlineGroups}
            formatAmount={formatAmount}
          />
          <BucketColumn
            label="Cash"
            total={formatAmount(data.cashTotal)}
            rows={data.cash}
            formatAmount={formatAmount}
          />
          <BucketColumn
            label="Credit"
            total={formatAmount(data.creditTotal)}
            rows={data.credit}
            formatAmount={formatAmount}
          />
        </div>
      )}
    </Card>
  );
}

// One bucket column. Either accepts a flat `rows` array (COD / Cash /
// Credit) or a `groups` array (Online), each group rendering its
// method label + sub-total + nested rows.
function BucketColumn({
  label,
  total,
  rows,
  groups,
  formatAmount,
}: {
  label: string;
  total: string;
  rows?: BucketRow[];
  groups?: { method: string; rows: BucketRow[]; total: number }[];
  formatAmount: (n: number) => string;
}) {
  const isEmpty =
    (rows ? rows.length === 0 : true) &&
    (groups ? groups.length === 0 : true);

  return (
    <div className="bg-card p-4">
      <div className="flex items-baseline justify-between gap-2 pb-3">
        <p className="text-sm font-semibold">{label}</p>
        <p
          className={`text-sm font-semibold tabular-nums ${
            isEmpty ? "text-muted-foreground" : ""
          }`}
        >
          {total}
        </p>
      </div>

      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.method} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1 text-xs">
                <span className="font-medium uppercase tracking-wide text-muted-foreground">
                  {g.method}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatAmount(g.total)}
                </span>
              </div>
              {g.rows.map((r) => (
                <BucketRowItem key={r.id} row={r} formatAmount={formatAmount} />
              ))}
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <BucketRowItem key={r.id} row={r} formatAmount={formatAmount} />
          ))}
        </div>
      )}
    </div>
  );
}

function BucketRowItem({
  row,
  formatAmount,
}: {
  row: BucketRow;
  formatAmount: (n: number) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-medium">{row.customer}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.courier ?? "—"}
        </p>
      </div>
      <p className="tabular-nums text-sm font-medium">
        {formatAmount(row.amount)}
      </p>
    </div>
  );
}
