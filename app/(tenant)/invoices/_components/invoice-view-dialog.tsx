"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Printer,
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  CalendarDays,
  Phone,
  CreditCard,
  Package,
  Plus,
  RefreshCw,
  BarChart3,
  Eye,
} from "lucide-react";
import { useCurrency } from "../../_components/providers";
import { generateCashMemoHtml } from "@/lib/invoice/cash-memo-template";
import { printCashMemo } from "@/lib/invoice/print-invoice";
import {
  getInvoiceDetailsAction,
  getInvoicePayloadAction,
  type InvoiceDetailRow,
} from "../actions";

// Eye-icon dialog. Renders the full invoice card directly in the
// dialog body (header + 4 KPIs + customer/pricing two-column +
// itemized order list + activity log) instead of an iframe of the
// cash-memo template — that gives a much denser, more useful view
// while keeping Print and Download HTML available in the footer
// (those still use the cash-memo HTML for print/file output).

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
};
const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
};

export function InvoiceViewDialog({
  saleId,
  open,
  onOpenChange,
}: {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { formatAmount } = useCurrency();
  const [data, setData] = useState<InvoiceDetailRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    setError(null);
    setData(null);
    getInvoiceDetailsAction(saleId)
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load invoice")
      )
      .finally(() => setLoading(false));
  }, [open, saleId]);

  // Print + Download HTML still use the cash-memo template + helpers.
  // We re-fetch the cash-memo payload (cheap; same DB hit) so this
  // dialog isn't tied to InvoiceSale's exact shape.
  async function handlePrint() {
    if (!saleId || printing) return;
    setPrinting(true);
    try {
      const p = await getInvoicePayloadAction(saleId);
      printCashMemo(p.sale, p.business, p.system);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to open print preview");
    } finally {
      setPrinting(false);
    }
  }

  async function handleDownloadHtml() {
    if (!saleId || downloading) return;
    setDownloading(true);
    try {
      const p = await getInvoicePayloadAction(saleId);
      const html = generateCashMemoHtml(p.sale, p.business, p.system);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `invoice-${p.sale.invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to download invoice");
    } finally {
      setDownloading(false);
    }
  }

  // Derived KPI numbers.
  const codDue =
    data && data.paymentTerms === "cod" ? data.amountDue : 0;
  const creditDue =
    data && data.paymentTerms === "credit" ? data.amountDue : 0;

  const lastUpdated = data?.activity[0]?.createdAt ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Layout recipe:
          • Width per breakpoint:
              mobile     → 100vw − 1rem  (0.5rem each side, 375×667 ✓)
              sm  (640)  → 100vw − 2rem  (1rem)
              md  (768)  → 100vw − 3rem  (1.5rem)
              lg  (1024) → 100vw − 4rem  (2rem, 1024×600 ✓)
            Capped at max-w-5xl (64rem ≈ 1024px). Uses `100vw` (not
            `100%`) because Radix locks body scroll and adds
            `padding-right: <scrollbar>` to compensate — with `100%`
            the calc evaluates against the shrunken body while the
            `left:50%` centering uses a slightly wider reference,
            producing asymmetric gaps.
          • Height: max-h-[92vh] caps total height so the dialog
            doesn't grow past the viewport.
          • Internal layout: 3-row CSS grid via `!grid-rows-[auto_minmax(0,1fr)_auto]`.
            Row 1 = header (auto), row 2 = body (1fr, the scrolling
            region), row 3 = footer (auto). With `!grid-rows`+`max-h`
            the header + footer stay pinned while only the body
            scrolls — fixes the "footer at the very bottom of long
            content" problem from the previous version.
          • `overflow-x-hidden` clips any wide child so horizontal
            scroll never leaks out to the body. */}
      <DialogContent className="!w-[calc(100vw-1rem)] sm:!w-[calc(100vw-2rem)] md:!w-[calc(100vw-3rem)] lg:!w-[calc(100vw-4rem)] !max-w-5xl !grid-rows-[auto_minmax(0,1fr)_auto] max-h-[92vh] overflow-hidden !p-0 !gap-0">
        {error ? (
          <div className="p-6">
            <DialogTitle className="sr-only">Invoice Error</DialogTitle>
            <DialogDescription className="sr-only">
              The invoice could not be loaded.
            </DialogDescription>
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          </div>
        ) : loading || !data ? (
          <>
            <DialogTitle className="sr-only">Loading invoice</DialogTitle>
            <DialogDescription className="sr-only">
              Fetching invoice details…
            </DialogDescription>
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : (
          <>
            {/* ─── Header (row 1 of grid, fixed) ───
                Mobile: title row gets `pr-12` clearance for the X
                close button; the badge row underneath uses full
                width. Desktop: badges sit on the right next to the
                close button so the entire header is one row with
                `sm:pr-14` clearance. */}
            <div className="border-b border-border/60 px-3 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:pr-14">
                {/* Title row — only this row needs the X clearance
                    on mobile because the badge row drops below. */}
                <div className="flex items-start gap-3 min-w-0 flex-1 pr-12 sm:pr-0">
                  <div className="rounded-md bg-muted p-2 shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-lg font-bold leading-tight truncate sm:text-xl">
                      {data.customerName}
                    </DialogTitle>
                    <p className="mt-0.5 text-xs font-mono text-muted-foreground">
                      {data.invoiceNumber}
                    </p>
                  </div>
                </div>
                {/* Badge row — full width on mobile, no right-padding
                    waste; sits next to title on desktop. */}
                <div className="flex flex-wrap items-center gap-1.5 sm:flex-shrink-0">
                  <PaymentStatusBadge status={data.paymentStatus} />
                  {data.courierStatus && (
                    <CourierStatusBadge status={data.courierStatus} />
                  )}
                </div>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Invoice details for {data.customerName}, invoice {data.invoiceNumber}.
            </DialogDescription>

            {/* ─── Body (row 2, scrollable) ───
                Only this region scrolls. `overflow-y-auto` here +
                `min-h-0` (implicit via grid `minmax(0,1fr)`) is the
                key to making sticky-style header/footer work. */}
            <div className="space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-5">
              {/* ─── 4 KPI cards ───
                  2-column on mobile (uses screen width better than
                  4 stacked cards), 4-column on lg+. */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                  label="ORDER VALUE"
                  value={formatAmount(data.grandTotal)}
                  hint="Total order amount"
                  icon={<DollarSign className="h-4 w-4 text-primary" />}
                />
                <KpiCard
                  label="TOTAL PAID"
                  value={formatAmount(data.amountPaid)}
                  hint="Amount received"
                  icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
                />
                <KpiCard
                  label="COD DUE"
                  value={formatAmount(codDue)}
                  hint="Cash on delivery"
                  icon={<Clock className="h-4 w-4 text-amber-500" />}
                  emphasized={codDue > 0}
                />
                <KpiCard
                  label="CREDIT DUE"
                  value={formatAmount(creditDue)}
                  hint="Credit balance"
                  icon={<CalendarDays className="h-4 w-4 text-primary" />}
                  emphasized={creditDue > 0}
                />
              </div>

              {/* ─── 2-column: Customer & Delivery / Payment & Pricing ─── */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Customer & Delivery */}
                <section className="rounded-lg border border-border/60 bg-card/50">
                  <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                    <Phone className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Customer &amp; Delivery
                    </h3>
                  </header>
                  <dl className="divide-y divide-border/60 text-sm">
                    <KvRow label="Customer" value={data.customerName} />
                    <KvRow label="Phone" value={data.customerPhone ?? "—"} />
                    <KvRow
                      label="WhatsApp"
                      value={data.customerWhatsapp ?? "—"}
                    />
                    <KvRow label="Address" value={data.customerAddress ?? "—"} />
                    <KvRow label="Courier" value={data.courierName ?? "—"} />
                    <KvRow label="CN Number" value={data.cnNumber ?? "Not set"} />
                    <KvRow label="Sale Date" value={formatDate(data.createdAt)} />
                  </dl>
                </section>

                {/* Payment & Pricing */}
                <section className="rounded-lg border border-border/60 bg-card/50">
                  <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Payment &amp; Pricing
                    </h3>
                  </header>
                  <dl className="divide-y divide-border/60 text-sm">
                    <KvRow label="Subtotal" value={formatAmount(data.subtotal)} />
                    <KvRow
                      label="Discount"
                      value={formatAmount(data.discountAmount)}
                    />
                    <KvRow label="Charge" value={formatAmount(data.charge)} />
                    <KvRow
                      label="Grand Total"
                      value={formatAmount(data.grandTotal)}
                      bold
                    />
                    <KvRow label="COD" value={formatAmount(codDue)} />
                    <KvRow label="Credit" value={formatAmount(creditDue)} />
                  </dl>
                </section>
              </div>

              {/* ─── Order Items ───
                  • < lg: card stack (each item is its own card with
                    image, name+variant, then Qty/Price/Total in a
                    compact 3-col grid). Suits all phones + iPad mini
                    portrait (768) + iPad Air portrait (820).
                  • lg+: classic 4-column table. */}
              <section className="rounded-lg border border-border/60 bg-card/50">
                <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Order items</h3>
                </header>

                {/* Card stack — all viewports below lg */}
                <div className="divide-y divide-border/60 lg:hidden">
                  {data.items.map((it) => (
                    <div key={it.id} className="flex gap-3 p-3">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imageUrl}
                          alt=""
                          className="h-12 w-12 flex-shrink-0 rounded-md border border-border/60 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-medium leading-tight break-words">
                          {it.productName}
                          {it.variantLabel && (
                            <span className="text-muted-foreground">
                              {" * "}
                              {it.variantLabel}
                            </span>
                          )}
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="block text-muted-foreground">Qty</span>
                            <span className="font-medium">{it.quantity}</span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground">
                              Sale Price
                            </span>
                            <span className="font-medium">
                              {formatAmount(it.unitPrice)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-muted-foreground">
                              Amount
                            </span>
                            <span className="font-semibold">
                              {formatAmount(it.totalPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table — lg and up */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Product</th>
                        <th className="px-4 py-2 text-center font-medium">Qty</th>
                        <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                          Sale Price
                        </th>
                        <th className="px-4 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data.items.map((it) => (
                        <tr key={it.id}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              {it.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={it.imageUrl}
                                  alt=""
                                  className="h-10 w-10 flex-shrink-0 rounded-md border border-border/60 object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="block truncate">
                                  {it.productName}
                                  {it.variantLabel && (
                                    <span className="text-muted-foreground">
                                      {" * "}
                                      {it.variantLabel}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">{it.quantity}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {formatAmount(it.unitPrice)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                            {formatAmount(it.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ─── Sale Activity ─── */}
              <section className="rounded-lg border border-border/60 bg-card/50">
                <header className="border-b border-border/60 px-4 py-3">
                  <h3 className="text-sm font-semibold">Sale Activity</h3>
                </header>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <ActivityStat
                    icon={<Plus className="h-4 w-4 text-primary" />}
                    label="Created"
                    value={formatDateTime(data.createdAt)}
                    accent="primary"
                  />
                  <ActivityStat
                    icon={<RefreshCw className="h-4 w-4 text-amber-500" />}
                    label="Last Updated"
                    value={lastUpdated ? formatDateTime(lastUpdated) : "No updates yet"}
                    accent="amber"
                  />
                  <ActivityStat
                    icon={<BarChart3 className="h-4 w-4 text-primary" />}
                    label="Update Count"
                    value={String(data.activity.length)}
                    accent="primary"
                  />
                </div>
                {data.activity.length > 0 && (
                  <div className="border-t border-border/60">
                    {/* Card stack — all viewports below lg */}
                    <div className="divide-y divide-border/60 lg:hidden">
                      {data.activity.map((a) => (
                        <div key={a.id} className="space-y-1.5 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="whitespace-nowrap">
                                {formatDateTime(a.createdAt)}
                              </span>
                            </div>
                            <span className="inline-flex rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] capitalize">
                              {a.action}
                            </span>
                          </div>
                          <p className="text-xs">
                            <span className="text-muted-foreground">
                              {a.user?.name ?? "—"}
                            </span>
                            {a.summary && (
                              <>
                                <span className="mx-1.5 text-muted-foreground">·</span>
                                {a.summary}
                              </>
                            )}
                          </p>
                          {a.details ? (
                            <div className="pt-0.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-md"
                                title={JSON.stringify(a.details)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View details
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    {/* Table — lg and up */}
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr className="text-xs text-muted-foreground">
                            <th className="px-4 py-2 text-left font-medium">
                              Date &amp; Time
                            </th>
                            <th className="px-4 py-2 text-left font-medium">User</th>
                            <th className="px-4 py-2 text-left font-medium">Action</th>
                            <th className="px-4 py-2 text-left font-medium">
                              Summary
                            </th>
                            <th className="px-4 py-2 text-right font-medium">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {data.activity.map((a) => (
                            <tr key={a.id}>
                              <td className="whitespace-nowrap px-4 py-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatDateTime(a.createdAt)}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-xs">
                                {a.user?.name ?? "—"}
                              </td>
                              <td className="px-4 py-2 text-xs">
                                <span className="inline-flex rounded-full border border-border/60 bg-background px-2 py-0.5 capitalize">
                                  {a.action}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-xs">
                                {a.summary ?? "—"}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-md"
                                  disabled={!a.details}
                                  title={
                                    a.details
                                      ? JSON.stringify(a.details)
                                      : "No details"
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* ─── Footer ───
                Mobile: regular block layout — three full-width
                buttons stacked Print → Download → Close (real DOM
                order matches visual order; no flex-col-reverse, no
                sticky positioning). iOS Safari handles sticky +
                reversed flex inconsistently which produced the
                "buttons shifted to the right" + "not stable on
                scroll" behaviour.

                Desktop (sm+): row layout, right-aligned, Print last
                (primary at the right edge per shadcn convention).
                Each button auto-width via sm:w-auto. */}
            <div className="border-t border-border/60 bg-background/95 px-3 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing}
                  className="w-full justify-center sm:order-3 sm:w-auto"
                >
                  {printing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadHtml}
                  disabled={downloading}
                  className="w-full justify-center sm:order-2 sm:w-auto"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Download HTML
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  type="button"
                  className="w-full justify-center sm:order-1 sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  icon,
  emphasized = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p
        className={`mt-2 text-2xl font-bold leading-none ${
          emphasized ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function KvRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5">
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={`text-right text-sm break-words min-w-0 ${
          bold ? "font-semibold" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ActivityStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: "primary" | "amber";
}) {
  const accentCls =
    accent === "primary"
      ? "border-primary/30 bg-primary/5"
      : "border-amber-500/30 bg-amber-500/5";
  return (
    <div className={`rounded-lg border ${accentCls} p-3`}>
      <div className="flex items-center gap-2">
        {icon}
        <span
          className={`text-xs font-semibold ${
            accent === "primary"
              ? "text-primary"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {label}
        </span>
      </div>
      <p
        className={`mt-1.5 text-sm font-semibold ${
          accent === "primary"
            ? "text-primary"
            : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  // Uses theme-token colors only — paid/success, partial+pending/
  // warning, cancelled/destructive. Previous "pink-500" for pending
  // was a raw Tailwind color and broke contrast in dark mode; warning
  // (the project's amber/orange semantic) is the right token.
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success border-success/30",
    partial: "bg-warning/15 text-warning border-warning/30",
    pending: "bg-warning/15 text-warning border-warning/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function CourierStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-background px-3 py-0.5 text-xs font-medium">
      {status}
    </span>
  );
}
