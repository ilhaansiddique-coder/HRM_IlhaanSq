"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCurrency } from "../../_components/providers";
import {
  getCustomerDueInvoicesAction,
  getCustomerPaymentHistoryAction,
  recordCustomerPaymentAction,
} from "../actions";
import {
  distributePaymentAmount,
  parseAmount,
  sanitizeAmountInput,
  validatePayNow,
  type DueInvoice,
} from "./payment-distribution";

type DueInvoiceFromAction = Awaited<ReturnType<typeof getCustomerDueInvoicesAction>>[number];
type HistoryEntry = Awaited<ReturnType<typeof getCustomerPaymentHistoryAction>>[number];

// Customer credit collection dialog. Two tabs: "Collect" (the live
// FIFO preview + Submit), and "History" (paginated audit trail of
// past payment_logs entries).
//
// FIFO/LIFO math, sanitization, validation: payment-distribution.ts
// Server-side equivalent + DB writes: customer-payment.service.ts
export function CustomerPaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  customerName: string | null;
}) {
  const { formatAmount } = useCurrency();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<DueInvoice[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [payNowValue, setPayNowValue] = useState("");

  const refresh = useMemo(
    () =>
      async (id: string) => {
        setLoading(true);
        setError(null);
        try {
          const [due, hist] = await Promise.all([
            getCustomerDueInvoicesAction(id),
            getCustomerPaymentHistoryAction(id),
          ]);
          // Map server payload (paymentTerms / paymentMethod / etc.)
          // down to the minimal DueInvoice shape the helpers need.
          setInvoices(
            due.map((d: DueInvoiceFromAction) => ({
              id: d.id,
              invoiceNumber: d.invoiceNumber,
              amountPaid: d.amountPaid,
              amountDue: d.amountDue,
              createdAt: d.createdAt,
            }))
          );
          setHistory(hist);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Failed to load credit data"
          );
        } finally {
          setLoading(false);
        }
      },
    []
  );

  useEffect(() => {
    if (!open || !customerId) return;
    setPayNowValue("");
    void refresh(customerId);
  }, [open, customerId, refresh]);

  // Live preview math.
  const totalPayNow = parseAmount(payNowValue);
  const totalCreditDue = useMemo(
    () => invoices.reduce((s, i) => s + i.amountDue, 0),
    [invoices]
  );
  const totalReversiblePaid = useMemo(
    () => invoices.reduce((s, i) => s + i.amountPaid, 0),
    [invoices]
  );

  const payNowError = useMemo(() => {
    if (!payNowValue.trim()) return ""; // empty = no validation, just disable Submit
    return validatePayNow(payNowValue, totalCreditDue, totalReversiblePaid);
  }, [payNowValue, totalCreditDue, totalReversiblePaid]);

  const distributedRows = useMemo(
    () =>
      distributePaymentAmount(
        invoices,
        payNowError ? 0 : totalPayNow
      ),
    [invoices, payNowError, totalPayNow]
  );

  const summary = useMemo(
    () =>
      distributedRows.reduce(
        (totals, inv) => {
          totals.totalDueAmount += inv.amountDue;
          totals.totalPaidAmount += inv.updatedPaidAmount;
          totals.totalDueBalance += inv.currentDueBalance;
          return totals;
        },
        { totalDueAmount: 0, totalPaidAmount: 0, totalDueBalance: 0 }
      ),
    [distributedRows]
  );

  const canSubmit =
    !pending &&
    !!customerId &&
    invoices.length > 0 &&
    !payNowError &&
    payNowValue.trim() !== "" &&
    payNowValue.trim() !== "-" &&
    totalPayNow !== 0;

  function handleSubmit() {
    if (!canSubmit || !customerId) return;
    setError(null);
    const fd = new FormData();
    fd.set("customerId", customerId);
    fd.set("amount", String(totalPayNow));
    startTransition(async () => {
      try {
        await recordCustomerPaymentAction(fd);
        setPayNowValue("");
        await refresh(customerId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to record payment");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Credit & Due — {customerName ?? "Customer"}
          </DialogTitle>
          <DialogDescription>
            Apply a payment against credit invoices (oldest first), or enter a
            negative amount to reverse a prior payment (most recent first).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-error/35 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <Tabs defaultValue="collect" className="space-y-4">
          <TabsList>
            <TabsTrigger value="collect">Collect</TabsTrigger>
            <TabsTrigger value="history">
              History
              {history.length > 0 && (
                <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                  {history.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Collect tab ── */}
          <TabsContent value="collect" className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : invoices.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  No credit-bearing invoices found for this customer.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Was Paid</TableHead>
                          <TableHead className="text-right">Allocated</TableHead>
                          <TableHead className="text-right">Now Paid</TableHead>
                          <TableHead className="text-right">Now Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {distributedRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">
                              {row.invoiceNumber}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(row.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatAmount(row.amountPaid)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${
                                row.allocatedAmount > 0
                                  ? "text-[#034b28] font-medium"
                                  : row.allocatedAmount < 0
                                    ? "text-amber-600 font-medium"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {row.allocatedAmount === 0
                                ? "—"
                                : (row.allocatedAmount > 0 ? "+" : "") +
                                  formatAmount(row.allocatedAmount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatAmount(row.updatedPaidAmount)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${
                                row.currentDueBalance > 0
                                  ? "text-amber-600 font-medium"
                                  : ""
                              }`}
                            >
                              {formatAmount(row.currentDueBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="space-y-3 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Total Credit Due
                      </span>
                      <span className="font-medium">
                        {formatAmount(summary.totalDueAmount)}
                      </span>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Pay Now (negative to reverse)
                        </label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={payNowValue}
                          onChange={(e) =>
                            setPayNowValue(sanitizeAmountInput(e.target.value))
                          }
                          placeholder="0.00"
                          aria-invalid={Boolean(payNowError)}
                          className={`h-10 ${
                            payNowError
                              ? "border-error focus-visible:ring-error/30"
                              : ""
                          }`}
                        />
                      </div>
                    </div>
                    {payNowError && (
                      <p className="text-xs text-error">{payNowError}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Positive amounts apply to the oldest due invoice first.
                      Negative amounts reverse from the most recently paid
                      invoice.
                    </p>
                    <div className="flex items-center justify-between border-t border-border/60 pt-2">
                      <span className="text-muted-foreground">After Submit</span>
                      <span className="font-medium">
                        Paid {formatAmount(summary.totalPaidAmount)} · Due{" "}
                        {formatAmount(summary.totalDueBalance)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── History tab ── */}
          <TabsContent value="history">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  No payment history yet.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(h.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {h.invoiceNumber}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              h.amount < 0 ? "text-amber-600" : "text-[#034b28]"
                            }`}
                          >
                            {h.amount > 0 ? "+" : ""}
                            {formatAmount(h.amount)}
                          </TableCell>
                          <TableCell className="text-xs">{h.paidByName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {totalPayNow < 0 ? "Record Adjustment" : "Record Payment"}
            {totalPayNow !== 0 && !payNowError && (
              <span className="ml-1.5 opacity-80">
                · {formatAmount(Math.abs(totalPayNow))}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to compute outstanding-credit per row (for the wallet icon's
// disabled state). Pulls from the same data shape we already serialize
// in CustomerList.
export function customerHasCreditDue(creditLimit: number | null): boolean {
  // Without a server-side credit_due field on the customer row, the
  // dialog itself fetches the live invoices on open. The wallet icon
  // is enabled whenever the customer COULD have credit (i.e. the
  // tenant has a credit limit set or any sale exists). Tightening this
  // would require denormalising credit_due onto the Customer row,
  // which the project intentionally avoids — see useCustomers in the
  // legacy src/ tree for the on-the-fly compute pattern.
  void creditLimit;
  return true;
}
