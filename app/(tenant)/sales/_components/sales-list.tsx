"use client";

import { useMemo, useState, useTransition } from "react";
import { useCurrency } from "../../_components/providers";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Search,
  ShoppingCart,
  Wallet,
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
import { toast } from "@/lib/toast";
import { cancelSaleAction } from "../actions";
import { NewSaleDialog } from "./new-sale-dialog";

export type SerializedSaleRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  courierStatus: string | null;
  createdAt: string;
  itemCount: number;
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

type StatusFilter = "all" | "paid" | "partial" | "pending" | "cancelled";

const statusOptions: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "partial", label: "Partial" },
  { key: "pending", label: "Pending" },
  { key: "cancelled", label: "Cancelled" },
];

export function SalesList({
  initialSales,
}: {
  initialSales: SerializedSaleRow[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [startDate, setStartDate] = useState<string>(""); // YYYY-MM-DD
  const [endDate, setEndDate] = useState<string>(""); // YYYY-MM-DD
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const { formatAmount } = useCurrency();
  const [pending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return initialSales.filter((s) => {
      if (statusFilter !== "all" && s.paymentStatus !== statusFilter) return false;
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
  }, [initialSales, search, statusFilter, startDate, endDate]);

  // KPIs reflect the filtered slice — what the user sees, not the
  // global total. Cancelled sales are excluded from "Revenue" so the
  // number stays meaningful when you flip filters.
  const kpis = useMemo(() => {
    const active = filtered.filter((s) => s.paymentStatus !== "cancelled");
    return {
      count: filtered.length,
      revenue: active.reduce((sum, s) => sum + s.grandTotal, 0),
      paid: active.reduce((sum, s) => sum + s.amountPaid, 0),
      due: active.reduce((sum, s) => sum + s.amountDue, 0),
    };
  }, [filtered]);

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

  function clearDates() {
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="space-y-4">
      {/* KPI cards. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Sales"
          value={kpis.count.toLocaleString()}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <KpiCard
          label="Revenue"
          value={formatAmount(kpis.revenue)}
          icon={<CircleDollarSign className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          label="Paid"
          value={formatAmount(kpis.paid)}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          accent="success"
        />
        <KpiCard
          label="Outstanding"
          value={formatAmount(kpis.due)}
          icon={<Wallet className="h-4 w-4 text-amber-500" />}
          accent="warning"
        />
      </div>

      {/* Search + new sale. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search by invoice, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setNewSaleOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Sale
        </Button>
      </div>

      {/* Status filter chips + date range. */}
      <Card className="rounded-lg p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <Button
                key={opt.key}
                variant={statusFilter === opt.key ? "default" : "outline"}
                size="sm"
                className="rounded-lg"
                onClick={() => setStatusFilter(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-auto"
            />
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-auto"
            />
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDates}
                className="h-9"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
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
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No sales found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sale) => {
                  const cancelled = sale.paymentStatus === "cancelled";
                  return (
                    <TableRow key={sale.id} className={cancelled ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-xs">
                        {sale.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <div>
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
                      <TableCell className="text-right text-emerald-600">
                        {formatAmount(sale.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          sale.amountDue > 0 ? "font-medium text-amber-600" : "text-muted-foreground"
                        }`}
                      >
                        {formatAmount(sale.amountDue)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={paymentVariants[sale.paymentStatus] ?? "outline"}>
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {!cancelled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={pending && cancellingId === sale.id}
                            onClick={() => handleCancel(sale.id, sale.invoiceNumber)}
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
            return (
              <Card
                key={sale.id}
                className={`rounded-lg p-3 ${cancelled ? "opacity-60" : ""}`}
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

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-emerald-500/10 px-2 py-1">
                    <span className="text-muted-foreground">Paid</span>
                    <p className="text-sm font-medium text-emerald-600">
                      {formatAmount(sale.amountPaid)}
                    </p>
                  </div>
                  <div
                    className={`rounded-md px-2 py-1 ${
                      sale.amountDue > 0 ? "bg-amber-500/10" : "bg-muted/40"
                    }`}
                  >
                    <span className="text-muted-foreground">Due</span>
                    <p
                      className={`text-sm font-medium ${
                        sale.amountDue > 0 ? "text-amber-600" : "text-foreground"
                      }`}
                    >
                      {formatAmount(sale.amountDue)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant={paymentVariants[sale.paymentStatus] ?? "outline"}
                    className="rounded-lg"
                  >
                    {sale.paymentStatus}
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
  icon,
  accent,
}: {
  label: string;
  value: string;
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
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClass}`}>{value}</div>
    </Card>
  );
}
