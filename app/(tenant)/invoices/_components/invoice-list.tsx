"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "../../_components/providers";
import {
  Search,
  FileText,
  Printer,
  Eye,
  FileBadge,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DATE_RANGE_PRESETS,
  type DateRangePresetKey,
} from "../../dashboard/_components/date-range-picker";
import { generateCashMemoHtml } from "@/lib/invoice/cash-memo-template";
import { printCashMemo } from "@/lib/invoice/print-invoice";
import { getInvoicePayloadAction } from "../actions";
import { InvoiceViewDialog } from "./invoice-view-dialog";

export type SerializedInvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  createdAt: string;
  dueDate: string | null;
  // Cross-tenant tagging — populated for super admin reads. Tenant
  // users get null and the column stays hidden.
  tenantId: string;
  tenantName: string | null;
};

type SaleWithRelations = SerializedInvoiceRow;

const paymentVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  partial: "secondary",
  paid: "default",
  cancelled: "destructive",
};

// Format dates as "Apr 26, 2026" — matches the screenshot.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
};

// Resolve `?range=` / `?from=`+`?to=` URL params into absolute Date
// bounds. Mirrors the resolver used by /sales: a preset wins over
// custom from/to; "all_time" returns null bounds (no constraint);
// anything missing falls back to today's bounds (the picker's default).
function resolveDateBounds(
  rangeParam: string | null,
  fromParam: string | null,
  toParam: string | null
): { start: Date | null; end: Date | null } {
  if (rangeParam) {
    const preset = DATE_RANGE_PRESETS.find(
      (p) => p.key === (rangeParam as DateRangePresetKey)
    );
    if (preset) {
      if (preset.key === "all_time") return { start: null, end: null };
      const r = preset.getRange();
      return { start: r.from, end: r.to };
    }
  }
  if (fromParam && toParam) {
    return {
      start: new Date(`${fromParam}T00:00:00`),
      end: new Date(`${toParam}T23:59:59.999`),
    };
  }
  // No URL params → default to "today" (matches DateRangePicker's
  // defaultPreset="today" on the TopBar).
  const today = DATE_RANGE_PRESETS.find((p) => p.key === "today");
  if (!today) return { start: null, end: null };
  const r = today.getRange();
  return { start: r.from, end: r.to };
}

export function InvoiceList({
  initialSales,
  thisMonthRevenue,
  showTenantColumn = false,
}: {
  initialSales: SaleWithRelations[];
  /** Server-computed revenue for the current calendar month, irrespective
   *  of the user's date filter. Stays a stable reference metric. */
  thisMonthRevenue: number;
  /** Super-admin view: render the owning tenant on each row so it's
   *  obvious which workspace generated each invoice. */
  showTenantColumn?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { formatAmount } = useCurrency();

  // Render the Tenant column whenever the prop says so OR whenever the
  // payload carries tenant info — same defensive pattern SalesList uses.
  const showTenant =
    showTenantColumn || initialSales.some((s) => !!s.tenantName);

  // ─── Row-level actions ──────────────────────────────────────
  // Eye → opens InvoiceViewDialog (cash-memo preview in iframe).
  // Printer → fetches the same payload and opens the system print
  //   window via printCashMemo (popup-blocker-safe).
  // FileText → fetches the payload, generates the cash-memo HTML, and
  //   downloads it as a self-contained .html file. Mirrors the Vite
  //   reference's handleDownloadInvoiceHTML exactly.
  const [viewingSaleId, setViewingSaleId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{
    saleId: string;
    kind: "print" | "download";
  } | null>(null);

  async function handlePrint(saleId: string) {
    if (busyAction) return;
    setBusyAction({ saleId, kind: "print" });
    try {
      const p = await getInvoicePayloadAction(saleId);
      printCashMemo(p.sale, p.business, p.system);
    } catch (e) {
      console.error("Print error", e);
      alert(e instanceof Error ? e.message : "Failed to open print preview");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownloadHtml(saleId: string) {
    if (busyAction) return;
    setBusyAction({ saleId, kind: "download" });
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
      console.error("Download error", e);
      alert(e instanceof Error ? e.message : "Failed to download invoice");
    } finally {
      setBusyAction(null);
    }
  }

  // URL-driven filter state — kept in sync with the TopBar's
  // InvoicesHeaderControls. Reading from URL means browser back/forward
  // restores the exact view, and the mobile inline search input below
  // (which doesn't have a TopBar equivalent on small screens) writes
  // to the same params so both inputs stay in lockstep.
  const urlQ = params.get("q") ?? "";
  const urlRange = params.get("range");
  const urlFrom = params.get("from");
  const urlTo = params.get("to");

  // Local input buffer so typing in the mobile search field is instant;
  // synced to the URL on a 250ms debounce.
  const [searchInput, setSearchInput] = useState(urlQ);
  useEffect(() => setSearchInput(urlQ), [urlQ]);
  useEffect(() => {
    if (searchInput === urlQ) return;
    const id = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (searchInput) p.set("q", searchInput);
      else p.delete("q");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, urlQ]);

  const { start, end } = useMemo(
    () => resolveDateBounds(urlRange, urlFrom, urlTo),
    [urlRange, urlFrom, urlTo]
  );

  const filtered = useMemo(() => {
    const q = urlQ.trim().toLowerCase();
    return initialSales.filter((s) => {
      if (q) {
        const matched =
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          // Super admin can also search by tenant name when the column is shown.
          (showTenant && s.tenantName?.toLowerCase().includes(q));
        if (!matched) return false;
      }
      if (start || end) {
        const t = new Date(s.createdAt).getTime();
        if (start && t < start.getTime()) return false;
        if (end && t > end.getTime()) return false;
      }
      return true;
    });
  }, [initialSales, urlQ, start, end, showTenant]);

  // KPI calculations — all four reflect the FILTERED set except
  // "This Month", which is server-computed against the full data so
  // it stays a stable reference even when the user narrows the view.
  const totalInvoices = filtered.length;
  const paidCount = filtered.filter((s) => s.paymentStatus === "paid").length;
  const pendingCount = filtered.filter(
    (s) => s.paymentStatus !== "paid" && s.paymentStatus !== "cancelled" && s.amountDue > 0
  ).length;
  const paymentRate =
    totalInvoices > 0 ? (paidCount / totalInvoices) * 100 : 0;
  const outstanding = filtered.reduce((sum, s) => sum + s.amountDue, 0);

  return (
    <div className="space-y-4">
      {/* 4 KPI cards matching the reference layout. Uses existing
          theme tokens: `border-border/70 bg-card/80` for the neutral
          frame; `text-error`/`text-success` for the accent values; no
          new colors introduced. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70 bg-card/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-semibold">
              Total Invoices
            </p>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-3xl font-bold leading-none">{totalInvoices}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Total invoices created
          </p>
        </Card>

        <Card className="border-border/70 bg-card/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-semibold">Paid Invoices</p>
            <FileBadge className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-3xl font-bold leading-none">{paidCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {paymentRate.toFixed(1)}% payment rate
          </p>
        </Card>

        <Card className="border-border/70 bg-card/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-semibold">
              Outstanding Amount
            </p>
            <FileText className="h-4 w-4 text-error" />
          </div>
          <p className="mt-3 text-3xl font-bold leading-none text-error">
            {formatAmount(outstanding)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {pendingCount} pending invoice{pendingCount === 1 ? "" : "s"}
          </p>
        </Card>

        <Card className="border-border/70 bg-card/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-base font-semibold">This Month</p>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-3xl font-bold leading-none">
            {formatAmount(thisMonthRevenue)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Month to date revenue
          </p>
        </Card>
      </div>

      {/* Mobile-only search. Desktop users use the TopBar's
          InvoicesHeaderControls (search + DateRangePicker). Both inputs
          are URL-synced via the `q` param — they share state through
          the URL, not local component state. */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search invoices by number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop: table view. Mobile uses the card stack below.
          Columns mirror the reference: Invoice # / Customer / Phone /
          Date / Due Date / Amount / Status / Actions (3 icons). */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showTenant && <TableHead>Tenant</TableHead>}
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Customer Phone Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showTenant ? 9 : 8}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    {showTenant && (
                      <TableCell className="text-xs">
                        {s.tenantName ? (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                            {s.tenantName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs font-medium">
                      {s.invoiceNumber}
                    </TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>
                      {s.customerPhone ? (
                        // Plain `tel:` link styled as primary text —
                        // matches the screenshot where phone numbers
                        // render in the brand accent color.
                        <a
                          href={`tel:${s.customerPhone}`}
                          className="text-primary hover:underline"
                        >
                          {s.customerPhone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(s.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(s.dueDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(s.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={paymentVariants[s.paymentStatus] ?? "outline"}
                        className="rounded-full"
                      >
                        {s.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-border/60"
                          title="View"
                          onClick={() => setViewingSaleId(s.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-border/60"
                          title="Print invoice (HTML)"
                          disabled={busyAction?.saleId === s.id && busyAction.kind === "print"}
                          onClick={() => void handlePrint(s.id)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-border/60"
                          title="Download invoice (HTML)"
                          disabled={busyAction?.saleId === s.id && busyAction.kind === "download"}
                          onClick={() => void handleDownloadHtml(s.id)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile: card stack mirroring the desktop columns — header
          row (customer + total amount), phone link, two date rows
          (Date / Due Date), status badge + 3 action icons. */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            <span className="text-sm">No invoices found</span>
          </Card>
        ) : (
          filtered.map((s) => (
            <Card key={s.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{s.customerName}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {s.invoiceNumber}
                  </p>
                </div>
                <p className="text-base font-semibold">
                  {formatAmount(s.grandTotal)}
                </p>
              </div>

              {showTenant && s.tenantName && (
                <div className="mt-2">
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    {s.tenantName}
                  </span>
                </div>
              )}

              {s.customerPhone && (
                <div className="mt-2 text-xs">
                  <a
                    href={`tel:${s.customerPhone}`}
                    className="text-primary hover:underline"
                  >
                    {s.customerPhone}
                  </a>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-medium">{formatDate(s.createdAt)}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Due: </span>
                  <span className="font-medium">{formatDate(s.dueDate)}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant={paymentVariants[s.paymentStatus] ?? "outline"}
                  className="rounded-full"
                >
                  {s.paymentStatus}
                </Badge>
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-border/60"
                    title="View"
                    onClick={() => setViewingSaleId(s.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-border/60"
                    title="Print invoice (HTML)"
                    disabled={busyAction?.saleId === s.id && busyAction.kind === "print"}
                    onClick={() => void handlePrint(s.id)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-border/60"
                    title="Download invoice (HTML)"
                    disabled={busyAction?.saleId === s.id && busyAction.kind === "download"}
                    onClick={() => void handleDownloadHtml(s.id)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <InvoiceViewDialog
        saleId={viewingSaleId}
        open={viewingSaleId !== null}
        onOpenChange={(o) => !o && setViewingSaleId(null)}
      />
    </div>
  );
}
