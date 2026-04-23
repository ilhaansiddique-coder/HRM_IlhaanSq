"use client";

import { useState } from "react";
import { useCurrency } from "../../_components/providers";
import { Search, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
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

export type SerializedSaleRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  paymentStatus: string;
  courierStatus: string | null;
  createdAt: string;
  itemCount: number;
};

type SaleWithRelations = SerializedSaleRow;

const paymentVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  partial: "secondary",
  paid: "default",
  cancelled: "destructive",
};

export function SalesList({
  initialSales,
}: {
  initialSales: SaleWithRelations[];
}) {
  const [search, setSearch] = useState("");
  const { formatAmount } = useCurrency();

  const filtered = initialSales.filter(
    (s) =>
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase()) ||
      s.customerPhone?.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
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
        <Link href="/sales/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Sale
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No sales found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sale) => (
                  <TableRow key={sale.id}>
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
                    <TableCell>
                      <Badge variant={paymentVariants[sale.paymentStatus] ?? "outline"}>
                        {sale.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {sale.courierStatus ?? "not_sent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
