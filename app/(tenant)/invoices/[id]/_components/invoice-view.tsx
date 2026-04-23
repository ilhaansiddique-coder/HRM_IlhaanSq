"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { printCashMemo } from "@/lib/invoice/print-invoice";
import { downloadCashMemoPdf } from "@/lib/invoice/download-pdf";
import type {
  InvoiceBusiness,
  InvoiceSale,
  InvoiceSystem,
} from "@/lib/invoice/types";

export function InvoiceView({
  sale,
  business,
  system,
}: {
  sale: InvoiceSale;
  business: InvoiceBusiness;
  system: InvoiceSystem;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbol = system.currencySymbol;
  const formatAmount = (n: number) =>
    `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  async function handleDownload() {
    setError(null);
    setDownloading(true);
    try {
      await downloadCashMemoPdf(sale, business, system);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    setError(null);
    try {
      printCashMemo(sale, business, system);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open print window");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:items-center print:hidden">
        {error && (
          <span className="text-sm text-destructive sm:mr-auto">{error}</span>
        )}
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Generating…" : "Download PDF"}
        </Button>
      </div>

      <div className="invoice-print-area mx-auto max-w-[820px] rounded-2xl border border-border/60 bg-card p-8 md:p-12 shadow-sm">
        {/* Header */}
        <div className="flex justify-between items-start pb-6 border-b border-border/60">
          <div className="flex items-start gap-3">
            {business.logoUrl && (
              <img
                src={business.logoUrl}
                alt={`${business.businessName} logo`}
                className="h-14 w-14 rounded-full object-cover border border-border/60"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {business.businessName}
              </h1>
              {(business.addressLine1 || business.address) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {business.addressLine1 ?? business.address}
                </p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                {business.phone && <span>📞 {business.phone}</span>}
                {business.email && <span>✉ {business.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Invoice
            </p>
            <p className="font-mono text-lg font-bold">{sale.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(sale.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Customer */}
        <div className="grid sm:grid-cols-2 gap-6 py-6 border-b border-border/60">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Bill To
            </p>
            <p className="font-semibold">{sale.customerName}</p>
            {sale.customerPhone && (
              <p className="text-sm text-muted-foreground">{sale.customerPhone}</p>
            )}
            {sale.customerAddress && (
              <p className="text-sm text-muted-foreground">
                {sale.customerAddress}
              </p>
            )}
          </div>
          <div className="text-right sm:text-left">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Status
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary capitalize">
                {sale.paymentStatus}
              </span>
              <span className="text-xs rounded-full px-2 py-0.5 bg-muted capitalize">
                {sale.paymentMethod}
              </span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="py-6">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60">
              <tr className="text-left">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit Price</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-border/40">
                  <td className="py-3">
                    {item.productName}
                    {item.variantLabel && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({item.variantLabel})
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">
                    {formatAmount(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatAmount(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatAmount(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>− {formatAmount(sale.discountAmount)}</span>
              </div>
            )}
            {sale.charge + sale.fee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>+ {formatAmount(sale.charge + sale.fee)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span>{formatAmount(sale.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Paid</span>
              <span>{formatAmount(sale.amountPaid)}</span>
            </div>
            {sale.amountDue > 0 && (
              <div className="flex justify-between text-warning font-medium">
                <span>Outstanding</span>
                <span>{formatAmount(sale.amountDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border/60 text-center">
          <p className="text-xs text-muted-foreground">
            {business.invoiceFooterMessage ?? "Thank you for your business"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Payment method: {sale.paymentMethod}
          </p>
        </div>
      </div>
    </>
  );
}
