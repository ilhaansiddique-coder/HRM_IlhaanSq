"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Banknote,
  CircleDollarSign,
  Clock,
  CreditCard,
  Smartphone,
  Truck,
} from "lucide-react";
import { useCurrency } from "../../_components/providers";
import type { SerializedSaleRow } from "./sales-list";

// Categorise a single sale's money flow into four buckets:
//   cash     — paid up front in cash
//   online   — paid via mobile money / bank / non-cash digital
//   codDue   — outstanding balance on a COD sale (collect on delivery)
//   creditDue — outstanding balance on a credit sale (pay later)
//
// Splits drive cash/online when they exist; otherwise fall back to the
// sale's default paymentMethod, classifying anything not literally
// "cash" as online.
function bucketsFor(sale: SerializedSaleRow): {
  cash: number;
  online: number;
  codDue: number;
  creditDue: number;
} {
  const cancelled = sale.paymentStatus === "cancelled";
  const codDue =
    !cancelled && sale.paymentTerms === "cod" ? sale.amountDue : 0;
  const creditDue =
    !cancelled && sale.paymentTerms === "credit" ? sale.amountDue : 0;

  let cash = 0;
  let online = 0;

  if (cancelled) {
    return { cash: 0, online: 0, codDue: 0, creditDue: 0 };
  }

  if (sale.payments.length > 0) {
    for (const p of sale.payments) {
      if (p.method.toLowerCase().includes("cash")) cash += p.amount;
      else online += p.amount;
    }
  } else if (sale.amountPaid > 0) {
    if (sale.paymentMethod.toLowerCase().includes("cash")) {
      cash = sale.amountPaid;
    } else {
      online = sale.amountPaid;
    }
  }

  return { cash, online, codDue, creditDue };
}

export function SalesHistoryDialog({
  open,
  onOpenChange,
  sales,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The list passed in here is already filtered by whatever the
  // toolbar has set (date range, status, user, etc.) so the history
  // view always reflects the current focus.
  sales: SerializedSaleRow[];
}) {
  const { formatAmount } = useCurrency();

  const rows = useMemo(
    () =>
      sales.map((s) => ({ sale: s, ...bucketsFor(s) })),
    [sales]
  );

  const totals = useMemo(() => {
    const t = { gross: 0, cash: 0, online: 0, codDue: 0, creditDue: 0 };
    for (const r of rows) {
      if (r.sale.paymentStatus !== "cancelled") {
        t.gross += r.sale.grandTotal;
      }
      t.cash += r.cash;
      t.online += r.online;
      t.codDue += r.codDue;
      t.creditDue += r.creditDue;
    }
    return t;
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sales History</DialogTitle>
          <DialogDescription>
            Per-sale breakdown of how each grand total split across cash,
            online, COD due, and credit due. Reflects the same filters the
            list above is using.
          </DialogDescription>
        </DialogHeader>

        {/* KPI strip — totals across the filtered slice. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label="Revenue"
            value={formatAmount(totals.gross)}
            icon={<CircleDollarSign className="h-4 w-4 text-primary" />}
          />
          <KpiCard
            label="Cash"
            value={formatAmount(totals.cash)}
            icon={<Banknote className="h-4 w-4 text-emerald-500" />}
            accent="success"
          />
          <KpiCard
            label="Online"
            value={formatAmount(totals.online)}
            icon={<Smartphone className="h-4 w-4 text-sky-500" />}
            accent="info"
          />
          <KpiCard
            label="COD Due"
            value={formatAmount(totals.codDue)}
            icon={<Truck className="h-4 w-4 text-amber-500" />}
            accent="warning"
          />
          <KpiCard
            label="Credit Due"
            value={formatAmount(totals.creditDue)}
            icon={<CreditCard className="h-4 w-4 text-violet-500" />}
            accent="violet"
          />
        </div>

        {rows.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Clock className="h-8 w-8 opacity-40" />
            <span className="text-sm">No sales in the current view</span>
          </Card>
        ) : (
          <>
            {/* Desktop table. */}
            <Card className="hidden md:block overflow-hidden rounded-lg">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Online</TableHead>
                      <TableHead className="text-right">COD Due</TableHead>
                      <TableHead className="text-right">Credit Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ sale, cash, online, codDue, creditDue }) => {
                      const cancelled = sale.paymentStatus === "cancelled";
                      return (
                        <TableRow
                          key={sale.id}
                          className={cancelled ? "opacity-60" : ""}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {sale.invoiceNumber}
                          </TableCell>
                          <TableCell>
                            <div className="leading-tight">
                              <span className="font-medium">{sale.customerName}</span>
                              {sale.customerPhone && (
                                <span className="block text-xs text-muted-foreground">
                                  {sale.customerPhone}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{sale.itemCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatAmount(sale.grandTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {cash > 0 ? (
                              <span className="text-emerald-600">{formatAmount(cash)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {online > 0 ? (
                              <span className="text-sky-600">{formatAmount(online)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {codDue > 0 ? (
                              <span className="text-amber-600 font-medium">
                                {formatAmount(codDue)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {creditDue > 0 ? (
                              <span className="text-violet-600 font-medium">
                                {formatAmount(creditDue)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                cancelled
                                  ? "destructive"
                                  : sale.paymentStatus === "paid"
                                    ? "default"
                                    : sale.paymentStatus === "partial"
                                      ? "secondary"
                                      : "outline"
                              }
                              className="rounded-lg"
                            >
                              {sale.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableHeader>
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={4} className="text-xs uppercase">
                        Totals
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAmount(totals.gross)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatAmount(totals.cash)}
                      </TableCell>
                      <TableCell className="text-right text-sky-600">
                        {formatAmount(totals.online)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatAmount(totals.codDue)}
                      </TableCell>
                      <TableCell className="text-right text-violet-600">
                        {formatAmount(totals.creditDue)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
            </Card>

            {/* Mobile cards. */}
            <div className="md:hidden space-y-3">
              {rows.map(({ sale, cash, online, codDue, creditDue }) => {
                const cancelled = sale.paymentStatus === "cancelled";
                return (
                  <Card
                    key={sale.id}
                    className={`rounded-lg p-3 ${cancelled ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight">
                          {sale.customerName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {sale.invoiceNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold">
                          {formatAmount(sale.grandTotal)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <Tile
                        label="Cash"
                        value={cash}
                        formatAmount={formatAmount}
                        accent="emerald"
                      />
                      <Tile
                        label="Online"
                        value={online}
                        formatAmount={formatAmount}
                        accent="sky"
                      />
                      <Tile
                        label="COD Due"
                        value={codDue}
                        formatAmount={formatAmount}
                        accent="amber"
                      />
                      <Tile
                        label="Credit Due"
                        value={creditDue}
                        formatAmount={formatAmount}
                        accent="violet"
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "success" | "warning" | "info" | "violet";
}) {
  const valueClass =
    accent === "success"
      ? "text-emerald-600"
      : accent === "warning"
        ? "text-amber-600"
        : accent === "info"
          ? "text-sky-600"
          : accent === "violet"
            ? "text-violet-600"
            : "text-foreground";
  return (
    <Card className="rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-1.5 text-lg font-bold ${valueClass}`}>{value}</div>
    </Card>
  );
}

function Tile({
  label,
  value,
  formatAmount,
  accent,
}: {
  label: string;
  value: number;
  formatAmount: (n: number) => string;
  accent: "emerald" | "sky" | "amber" | "violet";
}) {
  const tone = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600" },
    sky: { bg: "bg-sky-500/10", text: "text-sky-600" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600" },
  }[accent];
  return (
    <div className={`rounded-md ${value > 0 ? tone.bg : "bg-muted/40"} px-2 py-1`}>
      <span className="text-muted-foreground">{label}</span>
      <p
        className={`text-sm font-medium ${value > 0 ? tone.text : "text-foreground"}`}
      >
        {value > 0 ? formatAmount(value) : "—"}
      </p>
    </div>
  );
}
