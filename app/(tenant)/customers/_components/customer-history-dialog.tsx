"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getCustomerHistoryAction } from "../actions";

type HistoryPayload = NonNullable<
  Awaited<ReturnType<typeof getCustomerHistoryAction>>
>;

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  neutral: "secondary",
  inactive: "outline",
};

const paymentStatusTone: Record<string, string> = {
  paid: "text-[#034b28] dark:text-[#034b28]",
  partial: "text-amber-600 dark:text-amber-400",
  pending: "text-muted-foreground",
  cancelled: "text-rose-600 dark:text-rose-400",
};

// Read-only purchase history for a single customer. Renders three
// summary cards + a contact panel + a per-sale table. Data is fetched
// on open via a server action; the dialog itself doesn't talk to the
// DB.
export function CustomerHistoryDialog({
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
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customerId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const payload = await getCustomerHistoryAction(customerId);
        if (!active) return;
        if (!payload) {
          setError("Customer not found");
        } else {
          setData(payload);
        }
      } catch (e) {
        if (!active) return;
        setError(
          e instanceof Error ? e.message : "Failed to load purchase history"
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, customerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customerName ?? data?.customer.name ?? "Customer"} — Purchase
            history
          </DialogTitle>
          <DialogDescription>
            Read-only view of every sale recorded against this customer.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Total Spent"
                value={formatAmount(data.stats.totalSpent)}
                hint={`${data.stats.deliveredCount} delivered`}
                icon={<CircleDollarSign className="h-4 w-4" />}
                tone="emerald"
              />
              <SummaryCard
                label="Outstanding"
                value={formatAmount(data.stats.outstandingBalance)}
                hint={`${formatAmount(data.stats.creditDue)} on credit`}
                icon={<CalendarClock className="h-4 w-4" />}
                tone={data.stats.outstandingBalance > 0 ? "amber" : "indigo"}
              />
              <SummaryCard
                label="Total Orders"
                value={data.stats.orderCount.toString()}
                hint={`${data.stats.cancelledCount} cancelled / returned`}
                icon={<ShoppingBag className="h-4 w-4" />}
                tone="indigo"
              />
            </div>

            {/* Contact + status */}
            <Card className="border-border/70 bg-card/80">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <ContactRow
                    icon={<Phone className="h-3.5 w-3.5" />}
                    label="Phone"
                    value={data.customer.phone}
                  />
                  <ContactRow
                    icon={<MessageCircle className="h-3.5 w-3.5" />}
                    label="WhatsApp"
                    value={data.customer.whatsapp}
                    href={
                      data.customer.whatsapp
                        ? `https://wa.me/${data.customer.whatsapp.replace(/[^\d]/g, "")}`
                        : null
                    }
                  />
                  <ContactRow
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="Email"
                    value={data.customer.email}
                  />
                  <ContactRow
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label="Address"
                    value={data.customer.address}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={
                        statusVariants[data.customer.status] ?? "outline"
                      }
                    >
                      {data.customer.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Credit limit</span>
                    <span className="font-medium">
                      {data.customer.creditLimit != null
                        ? formatAmount(data.customer.creditLimit)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last purchase</span>
                    <span className="font-medium">
                      {data.customer.lastPurchaseDate
                        ? new Date(
                            data.customer.lastPurchaseDate
                          ).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  {data.customer.additionalInfo && (
                    <div className="rounded-md border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">
                      {data.customer.additionalInfo}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sales list */}
            {data.sales.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/30 px-4 py-12 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 opacity-40" />
                No sales recorded for this customer yet
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.itemCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(s.grandTotal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[#034b28] dark:text-[#034b28]">
                          {formatAmount(s.amountPaid)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            s.amountDue > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatAmount(s.amountDue)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              paymentStatusTone[s.paymentStatus] ??
                              "text-muted-foreground"
                            }`}
                          >
                            {s.paymentStatus === "paid" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : s.paymentStatus === "cancelled" ? (
                              <XCircle className="h-3 w-3" />
                            ) : null}
                            {s.paymentStatus}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const SUMMARY_TONES: Record<string, string> = {
  emerald: "text-[#034b28] bg-[#034b28]/10 dark:text-[#034b28]",
  indigo: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
  amber: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
};

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: keyof typeof SUMMARY_TONES;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${SUMMARY_TONES[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  href?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      {value ? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-right text-sm text-[#034b28] hover:underline dark:text-[#034b28]"
          >
            {value}
          </a>
        ) : (
          <span className="text-right text-sm font-medium">{value}</span>
        )
      ) : (
        <span className="text-right text-sm text-muted-foreground">—</span>
      )}
    </div>
  );
}
