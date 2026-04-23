"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "../../_components/providers";
import { RotateCcw, Trash2, Package, ShoppingCart, Users, FileText } from "lucide-react";
import {
  restoreProductAction,
  restoreSaleAction,
  restoreCustomerAction,
  permanentDeleteProductAction,
  permanentDeleteSaleAction,
  permanentDeleteCustomerAction,
} from "../actions";

export function TrashTab({
  deletedProducts,
  deletedSales,
  deletedCustomers,
}: {
  deletedProducts: any[];
  deletedSales: any[];
  deletedCustomers: any[];
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle>Trash Management</CardTitle>
        <p className="text-sm text-muted-foreground">
          Restore items or permanently delete them.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sales">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-4">
            <SalesTrashList items={deletedSales} />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <SalesTrashList items={deletedSales} />
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <CustomerTrashList items={deletedCustomers} />
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <ProductTrashList items={deletedProducts} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SalesTrashList({ items }: { items: any[] }) {
  const { formatAmount } = useCurrency();

  if (items.length === 0) {
    return (
      <EmptyState icon={<ShoppingCart className="h-8 w-8 opacity-40" />} label="No deleted sales" />
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-3">Sales</h3>
      {items.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="font-medium font-mono text-sm">{s.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">{s.customerName}</p>
            <p className="text-[10px] text-muted-foreground">
              Deleted {s.deletedAt ? new Date(s.deletedAt).toLocaleDateString() : "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{formatAmount(Number(s.grandTotal))}</span>
            <form action={restoreSaleAction} className="inline-block">
              <input type="hidden" name="id" value={s.id} />
              <Button type="submit" variant="ghost" size="sm">
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            </form>
            <form action={permanentDeleteSaleAction} className="inline-block">
              <input type="hidden" name="id" value={s.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerTrashList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <EmptyState icon={<Users className="h-8 w-8 opacity-40" />} label="No deleted customers" />;
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-3">Customers</h3>
      {items.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3"
        >
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.phone ?? c.email ?? "—"}</p>
          </div>
          <div className="flex gap-2">
            <form action={restoreCustomerAction}>
              <input type="hidden" name="id" value={c.id} />
              <Button type="submit" variant="ghost" size="sm">
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            </form>
            <form action={permanentDeleteCustomerAction}>
              <input type="hidden" name="id" value={c.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductTrashList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <EmptyState icon={<Package className="h-8 w-8 opacity-40" />} label="No deleted products" />;
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-3">Products</h3>
      {items.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3"
        >
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">SKU: {p.sku ?? "—"}</p>
          </div>
          <div className="flex gap-2">
            <form action={restoreProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <Button type="submit" variant="ghost" size="sm">
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            </form>
            <form action={permanentDeleteProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}
