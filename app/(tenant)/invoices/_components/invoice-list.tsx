"use client";

import { useState } from "react";
import { useCurrency } from "../../_components/providers";
import Link from "next/link";
import { Search, FileText, Printer, ExternalLink } from "lucide-react";
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

export type SerializedInvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  createdAt: string;
};

type SaleWithRelations = SerializedInvoiceRow;

const paymentVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  partial: "secondary",
  paid: "default",
  cancelled: "destructive",
};

export function InvoiceList({ initialSales }: { initialSales: SaleWithRelations[] }) {
  const [search, setSearch] = useState("");
  const { formatAmount } = useCurrency();

  const filtered = initialSales.filter(
    (s) =>
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalDue = filtered.reduce((sum, s) => sum + s.amountDue, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-card/80 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Invoiced</p>
          <p className="text-2xl font-semibold mt-1">{formatAmount(totalRevenue)}</p>
        </Card>
        <Card className="border-warning/35 bg-card/80 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding Due</p>
          <p className="text-2xl font-semibold text-warning mt-1">{formatAmount(totalDue)}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop: table view. Mobile uses the card stack below. */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-medium">{s.invoiceNumber}</TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatAmount(s.grandTotal)}</TableCell>
                    <TableCell className="text-right text-success">{formatAmount(s.amountPaid)}</TableCell>
                    <TableCell className="text-right">
                      {s.amountDue > 0 ? (
                        <span className="text-warning">{formatAmount(s.amountDue)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={paymentVariants[s.paymentStatus] ?? "outline"}>
                        {s.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Link href={`/invoices/${s.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View & Print">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/invoices/${s.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Print">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile: same data as a card stack — customer + total header,
          invoice number + date below, two-col paid/due grid, status badge,
          and a View & Print action at the foot. */}
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
                <div className="text-right">
                  <p className="text-base font-semibold">
                    {formatAmount(s.grandTotal)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Paid: </span>
                  <span className="font-semibold text-success">
                    {formatAmount(s.amountPaid)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Due: </span>
                  {s.amountDue > 0 ? (
                    <span className="font-semibold text-warning">
                      {formatAmount(s.amountDue)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant={paymentVariants[s.paymentStatus] ?? "outline"}
                  className="rounded-lg"
                >
                  {s.paymentStatus}
                </Badge>
                <Link href={`/invoices/${s.id}`} className="ml-auto">
                  <Button variant="outline" size="sm" className="rounded-lg">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View & Print
                  </Button>
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
