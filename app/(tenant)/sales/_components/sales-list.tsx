"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "../../_components/providers";
import {
  Ban,
  CreditCard,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/toast";
import { cancelSaleAction } from "../actions";
import { NewSaleDialog } from "./new-sale-dialog";
import { SalesHistoryDialog } from "./sales-history-dialog";
import {
  SalesToolbar,
  type ToolbarFilters,
  type StatusKey,
  type TermsKey,
  type CourierKey,
} from "./sales-toolbar";
import {
  DATE_RANGE_PRESETS,
  type DateRangePresetKey,
} from "../../dashboard/_components/date-range-picker";

export type SerializedSaleRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentTerms: string;
  courierStatus: string | null;
  dueDate: string | null;
  createdAt: string;
  createdById: string | null;
  createdByName: string | null;
  itemCount: number;
  payments: { method: string; amount: number }[];
};

const paymentVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  partial: "secondary",
  paid: "default",
  cancelled: "destructive",
};

// Convert a date preset to absolute [start, end] bounds. Returns null
// Resolve URL date params into absolute bounds.
//   range=<preset>   → bounds from DATE_RANGE_PRESETS (the shared list).
//   from + to        → custom calendar range (YYYY-MM-DD).
//   neither          → today's bounds (matches the picker's "today"
//                      default on /sales — empty URL = today's view).
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
      // "all_time" is functionally "no constraint" for filtering.
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
  // No URL params → fall back to "today" (the picker's default).
  const today = DATE_RANGE_PRESETS.find((p) => p.key === "today");
  if (!today) return { start: null, end: null };
  const r = today.getRange();
  return { start: r.from, end: r.to };
}

// Parse a comma-separated URL value into a Set, dropping empty strings.
const parseSet = <T extends string>(raw: string | null): Set<T> =>
  new Set(((raw ?? "").split(",").filter(Boolean) as T[]));

export function SalesList({
  initialSales,
}: {
  initialSales: SerializedSaleRow[];
}) {
  const { formatAmount } = useCurrency();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [newSaleOpen, setNewSaleOpen] = useState(false);

  // ─── URL-driven filter state ────────────────────────────────
  // Mirrored to URL params so the TopBar's SalesHeaderControls
  // (rendered above this tree) and the in-page toolbar stay in
  // lockstep. Browser back/forward also restores the exact filter
  // view. The shared DateRangePicker writes `range`/`from`/`to`.
  const urlQ = params.get("q") ?? "";
  const urlRange = params.get("range");
  const urlFrom = params.get("from");
  const urlTo = params.get("to");
  const urlStatuses = useMemo(() => parseSet<StatusKey>(params.get("status")), [params]);
  const urlTerms = useMemo(() => parseSet<TermsKey>(params.get("terms")), [params]);
  const urlCouriers = useMemo(() => parseSet<CourierKey>(params.get("courier")), [params]);
  const urlUser = params.get("user") ?? "";
  const urlHistory = params.get("history") === "1";

  // Search is buffered locally so typing stays instant; the buffer
  // syncs to the URL on a debounce. URL-side changes (back/forward,
  // TopBar input) hydrate back into the buffer.
  const [searchBuffer, setSearchBuffer] = useState(urlQ);
  useEffect(() => setSearchBuffer(urlQ), [urlQ]);
  useEffect(() => {
    if (searchBuffer === urlQ) return;
    const id = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (searchBuffer) p.set("q", searchBuffer);
      else p.delete("q");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
  }, [searchBuffer, urlQ, params, router]);

  // ─── Local-only state ───────────────────────────────────────
  // density is a personal UI preference, not part of the shareable
  // URL view. The legacy showCancelled local-state was retired when
  // the TopBar toggle started opening the Sales History dialog
  // (`history=1`) instead of filtering cancelled rows. Cancelled
  // rows are now always visible in the main list — they carry the
  // cancelled badge so they don't get confused with active sales.
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  // Compose into the unified ToolbarFilters shape SalesToolbar expects.
  // `showCancelled` is a no-op now (kept on the type for compatibility);
  // the dispatcher ignores it. Date params (`range`/`from`/`to`) are
  // managed by the shared DateRangePicker, not the toolbar.
  const filters: ToolbarFilters = {
    search: searchBuffer,
    statuses: urlStatuses,
    terms: urlTerms,
    couriers: urlCouriers,
    userId: urlUser,
    showCancelled: true,
    density,
  };

  // Single dispatcher: routes URL-driven fields to the URL and
  // local-only fields to React state. Search goes through the buffer
  // (debounced URL write).
  function setFilters(next: ToolbarFilters) {
    setSearchBuffer(next.search);
    setDensity(next.density);

    const p = new URLSearchParams(params.toString());

    const statusStr = Array.from(next.statuses).join(",");
    if (statusStr) p.set("status", statusStr);
    else p.delete("status");

    const termsStr = Array.from(next.terms).join(",");
    if (termsStr) p.set("terms", termsStr);
    else p.delete("terms");

    const courierStr = Array.from(next.couriers).join(",");
    if (courierStr) p.set("courier", courierStr);
    else p.delete("courier");

    if (next.userId) p.set("user", next.userId);
    else p.delete("user");

    router.replace(`?${p.toString()}`, { scroll: false });
  }

  // Distinct users present in the loaded sales — drives the "All Users"
  // dropdown so it only lists creators the viewer can actually filter to.
  const users = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of initialSales) {
      if (s.createdById && !seen.has(s.createdById)) {
        seen.set(s.createdById, s.createdByName ?? "Unknown");
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [initialSales]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const { start, end } = resolveDateBounds(urlRange, urlFrom, urlTo);

    return initialSales.filter((s) => {
      if (
        filters.statuses.size > 0 &&
        !filters.statuses.has(s.paymentStatus as StatusKey)
      ) {
        return false;
      }

      if (
        filters.terms.size > 0 &&
        !filters.terms.has(s.paymentTerms as TermsKey)
      ) {
        return false;
      }

      if (filters.couriers.size > 0) {
        const c = (s.courierStatus ?? "not_sent") as CourierKey;
        if (!filters.couriers.has(c)) return false;
      }

      if (filters.userId && s.createdById !== filters.userId) return false;

      if (start || end) {
        const d = new Date(s.createdAt);
        if (start && d < start) return false;
        if (end && d > end) return false;
      }

      if (q) {
        const hit =
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          (s.customerPhone ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [initialSales, filters, urlRange, urlFrom, urlTo]);

  // KPIs reflect the filtered slice — what the user sees, not the
  // global total. Cancelled rows excluded from money columns so the
  // numbers stay meaningful when the cancelled toggle flips on.
  // COD Due / Credit Due are split out from a generic "Outstanding"
  // so the two collection channels each get their own KPI tile.
  const kpis = useMemo(() => {
    const active = filtered.filter((s) => s.paymentStatus !== "cancelled");
    return {
      count: active.length,
      revenue: active.reduce((sum, s) => sum + s.grandTotal, 0),
      paid: active.reduce((sum, s) => sum + s.amountPaid, 0),
      codDue: active.reduce(
        (sum, s) => sum + (s.paymentTerms === "cod" ? s.amountDue : 0),
        0
      ),
      creditDue: active.reduce(
        (sum, s) => sum + (s.paymentTerms === "credit" ? s.amountDue : 0),
        0
      ),
    };
  }, [filtered]);

  // "Outstanding" = needs attention. Either the buyer still owes money
  // and no term implies it'll be collected later, OR a credit sale's
  // due date has already passed. Cancelled rows never count.
  const alertCount = useMemo(() => {
    const now = Date.now();
    return initialSales.filter((s) => {
      if (s.paymentStatus === "cancelled") return false;
      if (s.amountDue <= 0) return false;
      if (s.paymentTerms === "credit" && s.dueDate) {
        return new Date(s.dueDate).getTime() < now;
      }
      return s.paymentStatus === "pending" || s.paymentStatus === "partial";
    }).length;
  }, [initialSales]);

  function handleAlertClick() {
    // Surface the outstanding subset: pending + partial.
    setFilters({
      ...filters,
      statuses: new Set<StatusKey>(["pending", "partial"]),
    });
  }

  function closeHistory() {
    const p = new URLSearchParams(params.toString());
    p.delete("history");
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  function handleCancel(saleId: string, invoice: string) {
    if (
      !window.confirm(
        `Cancel sale ${invoice}? This restores stock and marks the sale as cancelled (it will stay visible).`
      )
    ) {
      return;
    }
    setCancellingId(saleId);
    const fd = new FormData();
    fd.set("saleId", saleId);
    startTransition(async () => {
      try {
        await cancelSaleAction(fd);
        toast.success("Sale cancelled, inventory restored");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to cancel sale");
      } finally {
        setCancellingId(null);
      }
    });
  }

  const compact = filters.density === "compact";
  const cellPad = compact ? "py-1.5" : "py-3";
  const cardPad = compact ? "p-2" : "p-3";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatAmount(kpis.revenue)}
          sublabel={`From ${kpis.count.toLocaleString()} sale${kpis.count === 1 ? "" : "s"}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Amount Paid"
          value={formatAmount(kpis.paid)}
          sublabel="Received payments"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="COD Due"
          value={formatAmount(kpis.codDue)}
          sublabel="Courier due"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Credit Due"
          value={formatAmount(kpis.creditDue)}
          sublabel="Credit outstanding"
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* In-page toolbar — mobile only. On desktop the TopBar carries
          the same controls (search / date / filters / users) plus the
          New Sale button, and the alert/density bits are redundant
          with the KPI strip. The whole Card is hidden above md. */}
      <Card className="rounded-lg p-3 md:hidden">
        <SalesToolbar
          filters={filters}
          onChange={setFilters}
          users={users}
          alertCount={alertCount}
          onAlertClick={handleAlertClick}
          onNewSale={() => setNewSaleOpen(true)}
        />
      </Card>

      {/* Desktop table. */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No sales found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sale) => {
                  const cancelled = sale.paymentStatus === "cancelled";
                  const isOverdue =
                    sale.paymentTerms === "credit" &&
                    sale.dueDate &&
                    new Date(sale.dueDate).getTime() < Date.now() &&
                    sale.amountDue > 0 &&
                    !cancelled;
                  return (
                    <TableRow
                      key={sale.id}
                      className={cancelled ? "opacity-60" : ""}
                    >
                      <TableCell className={`font-mono text-xs ${cellPad}`}>
                        {sale.invoiceNumber}
                      </TableCell>
                      <TableCell className={cellPad}>
                        <div>
                          <span className="font-medium">{sale.customerName}</span>
                          {sale.customerPhone && (
                            <span className="block text-xs text-muted-foreground">
                              {sale.customerPhone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={cellPad}>{sale.itemCount}</TableCell>
                      <TableCell className={`text-right font-medium ${cellPad}`}>
                        {formatAmount(sale.grandTotal)}
                      </TableCell>
                      <TableCell className={`text-right text-emerald-600 ${cellPad}`}>
                        {formatAmount(sale.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${cellPad} ${
                          sale.amountDue > 0
                            ? isOverdue
                              ? "font-semibold text-destructive"
                              : "font-medium text-amber-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatAmount(sale.amountDue)}
                        {isOverdue && (
                          <span className="ml-1 text-[10px] uppercase">overdue</span>
                        )}
                      </TableCell>
                      <TableCell className={cellPad}>
                        <Badge
                          variant={
                            paymentVariants[sale.paymentStatus] ?? "outline"
                          }
                        >
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs capitalize ${cellPad}`}>
                        {sale.paymentTerms}
                      </TableCell>
                      <TableCell className={`text-xs text-muted-foreground ${cellPad}`}>
                        {sale.createdByName ?? "—"}
                      </TableCell>
                      <TableCell
                        className={`text-xs text-muted-foreground ${cellPad}`}
                      >
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className={`text-right ${cellPad}`}>
                        {!cancelled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={pending && cancellingId === sale.id}
                            onClick={() =>
                              handleCancel(sale.id, sale.invoiceNumber)
                            }
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <NewSaleDialog open={newSaleOpen} onOpenChange={setNewSaleOpen} />

      <SalesHistoryDialog
        open={urlHistory}
        onOpenChange={(o) => {
          if (!o) closeHistory();
        }}
        sales={filtered}
      />

      {/* Mobile card stack. */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 opacity-40" />
            <span className="text-sm">No sales found</span>
          </Card>
        ) : (
          filtered.map((sale) => {
            const cancelled = sale.paymentStatus === "cancelled";
            const isOverdue =
              sale.paymentTerms === "credit" &&
              sale.dueDate &&
              new Date(sale.dueDate).getTime() < Date.now() &&
              sale.amountDue > 0 &&
              !cancelled;
            return (
              <Card
                key={sale.id}
                className={`rounded-lg ${cardPad} ${cancelled ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{sale.customerName}</p>
                    {sale.customerPhone && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {sale.customerPhone}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
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

                <div className={`${compact ? "mt-1.5" : "mt-2"} grid grid-cols-2 gap-2 text-xs`}>
                  <div className="rounded-md bg-emerald-500/10 px-2 py-1">
                    <span className="text-muted-foreground">Paid</span>
                    <p className="text-sm font-medium text-emerald-600">
                      {formatAmount(sale.amountPaid)}
                    </p>
                  </div>
                  <div
                    className={`rounded-md px-2 py-1 ${
                      sale.amountDue > 0
                        ? isOverdue
                          ? "bg-destructive/10"
                          : "bg-amber-500/10"
                        : "bg-muted/40"
                    }`}
                  >
                    <span className="text-muted-foreground">
                      {isOverdue ? "Overdue" : "Due"}
                    </span>
                    <p
                      className={`text-sm font-medium ${
                        sale.amountDue > 0
                          ? isOverdue
                            ? "text-destructive"
                            : "text-amber-600"
                          : "text-foreground"
                      }`}
                    >
                      {formatAmount(sale.amountDue)}
                    </p>
                  </div>
                </div>

                <div className={`${compact ? "mt-2" : "mt-3"} flex flex-wrap items-center gap-2 text-xs`}>
                  <Badge
                    variant={paymentVariants[sale.paymentStatus] ?? "outline"}
                    className="rounded-lg"
                  >
                    {sale.paymentStatus}
                  </Badge>
                  <Badge variant="outline" className="rounded-lg capitalize">
                    {sale.paymentTerms}
                  </Badge>
                  <span className="text-muted-foreground">
                    {sale.itemCount} item{sale.itemCount !== 1 ? "s" : ""}
                  </span>
                  {!cancelled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={pending && cancellingId === sale.id}
                      onClick={() => handleCancel(sale.id, sale.invoiceNumber)}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  accent?: "success" | "warning";
}) {
  const valueClass =
    accent === "success"
      ? "text-emerald-600"
      : accent === "warning"
        ? "text-amber-600"
        : "text-foreground";
  return (
    <Card className="rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
      {sublabel && (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      )}
    </Card>
  );
}
