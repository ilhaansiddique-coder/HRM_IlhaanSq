"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "../../_components/providers";
import { getSaleAction } from "../actions";

type SalePayload = Awaited<ReturnType<typeof getSaleAction>>;

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  partial: "secondary",
  pending: "outline",
  cancelled: "destructive",
};

// Read-only modal triggered by the eye icon on each sales row. Shows
// the sale's full record + items + payment history + courier info.
// All actions (edit / print / cancel / delete) live on the parent
// row — this dialog is purely informational.
export function SaleDetailsDialog({
  open,
  onOpenChange,
  saleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}) {
  const [sale, setSale] = useState<SalePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formatAmount } = useCurrency();

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    setError(null);
    setSale(null);
    getSaleAction(saleId)
      .then(setSale)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load sale")
      )
      .finally(() => setLoading(false));
  }, [open, saleId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <span>Invoice {sale?.invoiceNumber ?? "…"}</span>
                {sale && (
                  <Badge
                    variant={statusVariant[sale.paymentStatus] ?? "outline"}
                    className="rounded-md"
                  >
                    {sale.paymentStatus}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {sale
                  ? new Date(sale.createdAt).toLocaleString()
                  : "Loading sale…"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : loading || !sale ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer */}
            <Card>
              <CardContent className="p-3 text-sm space-y-1">
                <div className="font-semibold">{sale.customerName}</div>
                <div className="text-muted-foreground space-y-0.5 text-xs">
                  {sale.customerPhone && <div>Phone: {sale.customerPhone}</div>}
                  {sale.customerWhatsapp && (
                    <div>WhatsApp: {sale.customerWhatsapp}</div>
                  )}
                  {sale.customerAddress && <div>{sale.customerAddress}</div>}
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.productName}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {it.variantLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatAmount(it.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(it.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardContent className="p-3 text-sm">
                <div className="grid grid-cols-2 gap-y-1">
                  <Row label="Subtotal" value={formatAmount(sale.subtotal)} />
                  <Row label="Discount" value={`- ${formatAmount(sale.discountAmount)}`} />
                  <Row label="Charge" value={formatAmount(sale.charge)} />
                  <div className="col-span-2 my-1 border-t border-border/60" />
                  <Row label="Grand Total" value={formatAmount(sale.grandTotal)} bold />
                  <Row
                    label="Paid"
                    value={formatAmount(sale.amountPaid)}
                    cls="text-emerald-600"
                  />
                  <Row
                    label="Due"
                    value={formatAmount(sale.amountDue)}
                    cls={sale.amountDue > 0 ? "text-amber-600" : ""}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payments */}
            {sale.payments.length > 0 && (
              <Card>
                <CardContent className="p-3 text-sm space-y-1">
                  <div className="font-semibold">Payment splits</div>
                  {sale.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground capitalize">
                        {p.method}
                      </span>
                      <span className="font-medium">{formatAmount(p.amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Courier */}
            {(sale.courierName || sale.cnNumber || sale.courierStatus) && (
              <Card>
                <CardContent className="p-3 text-sm space-y-1">
                  <div className="font-semibold">Courier</div>
                  {sale.courierName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span>{sale.courierName}</span>
                    </div>
                  )}
                  {sale.cnNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CN Number</span>
                      <span className="font-mono text-xs">{sale.cnNumber}</span>
                    </div>
                  )}
                  {sale.courierStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="rounded-md text-xs">
                        {sale.courierStatus}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Meta */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Payment terms: {sale.paymentTerms}</div>
              {sale.dueDate && (
                <div>Due: {new Date(sale.dueDate).toLocaleDateString()}</div>
              )}
              {sale.creator && <div>Created by: {sale.creator.name}</div>}
              {sale.additionalInfo && (
                <div>Notes: {sale.additionalInfo}</div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  bold = false,
  cls = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  cls?: string;
}) {
  return (
    <>
      <span className={`text-muted-foreground ${bold ? "font-bold text-foreground" : ""}`}>
        {label}
      </span>
      <span className={`text-right ${bold ? "font-bold" : ""} ${cls}`}>
        {value}
      </span>
    </>
  );
}
