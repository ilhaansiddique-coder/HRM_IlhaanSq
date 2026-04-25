"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "../../_components/providers";
import {
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  bulkUpdateCourierStatusAction,
  cancelSaleAction,
  deleteSaleAction,
  duplicateSaleAction,
  updateSaleStatusAction,
} from "../actions";
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
  courierName: string | null;
  cnNumber: string | null;
  dueDate: string | null;
  createdAt: string;
  createdById: string | null;
  createdByName: string | null;
  itemCount: number;
  payments: { method: string; amount: number }[];
  // Cross-tenant tagging — populated for super admin reads. Tenant
  // users see null and the tenant column doesn't render.
  tenantId: string;
  tenantName: string | null;
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

// Courier status dropdown options — keep label/value separated so the
// underlying enum-ish strings stay snake_case while the UI reads cleanly.
const courierStatusOptions = [
  { value: "not_sent", label: "Not Sent" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
  { value: "lost", label: "Lost" },
] as const;

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
  showTenantColumn = false,
}: {
  initialSales: SerializedSaleRow[];
  // Super-admin view: render the owning tenant on each row so it's
  // obvious which workspace generated each invoice.
  showTenantColumn?: boolean;
}) {
  const { formatAmount } = useCurrency();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
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

  // ─── Per-row actions ────────────────────────────────────────
  // The action icons in the table all share this `runAction` pattern:
  // confirm if needed, set the busy id, fire the server action, toast
  // result, clear busy id.
  function runAction(
    saleId: string,
    formAction: (fd: FormData) => Promise<unknown>,
    successMsg: string,
    errorMsg: string,
    extra?: Record<string, string>
  ) {
    setBusyId(saleId);
    const fd = new FormData();
    fd.set("saleId", saleId);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    }
    startTransition(async () => {
      try {
        await formAction(fd);
        toast.success(successMsg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : errorMsg);
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleDelete(saleId: string, invoice: string) {
    if (
      !window.confirm(
        `Delete sale ${invoice}? This restores stock and moves the sale to trash.`
      )
    )
      return;
    runAction(
      saleId,
      deleteSaleAction,
      "Sale deleted, inventory restored",
      "Failed to delete sale"
    );
  }

  function handleDuplicate(saleId: string) {
    runAction(
      saleId,
      duplicateSaleAction,
      "Sale duplicated",
      "Failed to duplicate sale"
    );
  }

  function handleCourierStatusChange(saleId: string, courierStatus: string) {
    runAction(
      saleId,
      updateSaleStatusAction,
      `Courier status: ${courierStatus.replace("_", " ")}`,
      "Failed to update courier status",
      { courierStatus }
    );
  }

  // Unimplemented actions — keep the icons in the row to match the
  // reference design, but make it explicit that the wiring is pending.
  function comingSoon(label: string) {
    toast.info(`${label} is coming soon.`);
  }

  // ─── Bulk actions ───────────────────────────────────────────
  function applyBulkStatus() {
    if (selected.size === 0) {
      toast.info("Select at least one sale first.");
      return;
    }
    if (!bulkStatus) {
      toast.info("Pick a courier status to apply.");
      return;
    }
    const fd = new FormData();
    fd.set("saleIds", Array.from(selected).join(","));
    fd.set("courierStatus", bulkStatus);
    startTransition(async () => {
      try {
        await bulkUpdateCourierStatusAction(fd);
        toast.success(`Updated ${selected.size} sale${selected.size === 1 ? "" : "s"}`);
        setSelected(new Set());
        setBulkStatus("");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to update sales"
        );
      }
    });
  }

  // Avoid the unused-import warning while cancelSaleAction stays in
  // scope for potential future bulk-cancel wiring.
  void cancelSaleAction;

  const compact = filters.density === "compact";
  const cellPad = compact ? "py-1.5" : "py-3";
  const cardPad = compact ? "p-2" : "p-3";

  // Render the Tenant column whenever the prop says so OR whenever the
  // payload actually carries tenant info. The OR fallback covers the
  // edge case where a stale JWT lacks the isSuperAdmin flag — if the
  // page already loaded cross-tenant data, the column should still
  // appear so super admins can tell tenants apart at a glance.
  const showTenant =
    showTenantColumn || initialSales.some((s) => !!s.tenantName);

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

      {/* Desktop bulk header — Bulk Status select + Bulk Print +
          refresh, plus a count of selected rows. */}
      <Card className="hidden md:block rounded-lg p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : "Select rows for bulk actions"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => router.refresh()}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Select
                value={bulkStatus}
                onValueChange={(v) => setBulkStatus(v)}
                disabled={selected.size === 0}
              >
                <SelectTrigger className="h-9 w-36 rounded-lg">
                  <SelectValue placeholder="Bulk Status" />
                </SelectTrigger>
                <SelectContent>
                  {courierStatusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                disabled={selected.size === 0 || !bulkStatus || pending}
                onClick={applyBulkStatus}
              >
                Apply
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg"
              disabled={selected.size === 0}
              onClick={() => comingSoon("Bulk Print")}
            >
              <Printer className="h-4 w-4" />
              Bulk Print
            </Button>
          </div>
        </div>
      </Card>

      {/* Desktop table. */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 && selected.size === filtered.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(filtered.map((s) => s.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    aria-label="Select all"
                  />
                </TableHead>
                {showTenant && <TableHead>Tenant</TableHead>}
                <TableHead>Customer</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due/Credit</TableHead>
                <TableHead>P. Method</TableHead>
                <TableHead>Courier Name</TableHead>
                <TableHead>CN Number</TableHead>
                <TableHead>Courier Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showTenant ? 12 : 11}
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
                  const checked = selected.has(sale.id);
                  const rowBusy = pending && busyId === sale.id;
                  return (
                    <TableRow
                      key={sale.id}
                      className={cancelled ? "opacity-60" : ""}
                    >
                      <TableCell className={cellPad}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(sale.id);
                            else next.delete(sale.id);
                            setSelected(next);
                          }}
                          aria-label={`Select ${sale.invoiceNumber}`}
                        />
                      </TableCell>
                      {showTenant && (
                        <TableCell className={`text-xs ${cellPad}`}>
                          {sale.tenantName ? (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                              {sale.tenantName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className={cellPad}>
                        <div className="leading-tight">
                          <span className="font-medium">{sale.customerName}</span>
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {sale.invoiceNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`text-xs text-muted-foreground ${cellPad}`}
                      >
                        {sale.customerPhone ?? "—"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${cellPad}`}>
                        {formatAmount(sale.grandTotal)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${cellPad} ${sale.amountPaid > 0 ? "text-emerald-600" : "text-muted-foreground"}`}
                      >
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
                      <TableCell className={`text-xs uppercase ${cellPad}`}>
                        {sale.paymentMethod}
                      </TableCell>
                      <TableCell
                        className={`text-xs ${cellPad} ${sale.courierName ? "" : "text-muted-foreground"}`}
                      >
                        {sale.courierName ?? "—"}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-xs ${cellPad} ${
                          sale.cnNumber ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {sale.cnNumber ?? "—"}
                      </TableCell>
                      <TableCell className={cellPad}>
                        <Select
                          value={sale.courierStatus ?? "not_sent"}
                          onValueChange={(v) =>
                            handleCourierStatusChange(sale.id, v)
                          }
                          disabled={cancelled || rowBusy}
                        >
                          <SelectTrigger className="h-8 w-32 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {courierStatusOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className={`text-right ${cellPad}`}>
                        <div className="inline-flex items-center gap-0.5">
                          <ActionIcon
                            label="Edit"
                            onClick={() => comingSoon("Edit Sale")}
                            disabled={rowBusy}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="View"
                            onClick={() => comingSoon("View Sale")}
                            disabled={rowBusy}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="Add courier"
                            onClick={() => comingSoon("Courier Add")}
                            disabled={rowBusy}
                          >
                            <Truck className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="Print"
                            onClick={() => comingSoon("Print Invoice")}
                            disabled={rowBusy}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="Duplicate"
                            onClick={() => handleDuplicate(sale.id)}
                            disabled={rowBusy || cancelled}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="Refresh courier"
                            onClick={() => comingSoon("Refresh Courier")}
                            disabled={rowBusy}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </ActionIcon>
                          <ActionIcon
                            label="Delete"
                            onClick={() =>
                              handleDelete(sale.id, sale.invoiceNumber)
                            }
                            disabled={rowBusy}
                            destructive
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ActionIcon>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          Showing {filtered.length === 0 ? 0 : 1}-{filtered.length} of{" "}
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
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

                {showTenant && sale.tenantName && (
                  <div className="mt-2">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      {sale.tenantName}
                    </span>
                  </div>
                )}

                <div className={`${compact ? "mt-2" : "mt-3"} grid grid-cols-2 gap-2 text-[11px] text-muted-foreground`}>
                  <div>
                    <span>P. Method</span>
                    <p className="text-foreground uppercase">{sale.paymentMethod}</p>
                  </div>
                  <div>
                    <span>Courier</span>
                    <p className="text-foreground">{sale.courierName ?? "—"}</p>
                  </div>
                  <div>
                    <span>CN</span>
                    <p
                      className={`font-mono ${sale.cnNumber ? "text-primary" : "text-foreground"}`}
                    >
                      {sale.cnNumber ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span>Status</span>
                    <p className="text-foreground capitalize">
                      {(sale.courierStatus ?? "not_sent").replace("_", " ")}
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
                  <div className="ml-auto inline-flex items-center gap-0.5">
                    <ActionIcon
                      label="Duplicate"
                      onClick={() => handleDuplicate(sale.id)}
                      disabled={(pending && busyId === sale.id) || cancelled}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </ActionIcon>
                    <ActionIcon
                      label="Delete"
                      onClick={() => handleDelete(sale.id, sale.invoiceNumber)}
                      disabled={pending && busyId === sale.id}
                      destructive
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ActionIcon>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// Square icon button with a thin border, used for the per-row action
// row in the sales table. Mirrors the reference design's white-pill
// look. `destructive` styles the trash variant.
function ActionIcon({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
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
