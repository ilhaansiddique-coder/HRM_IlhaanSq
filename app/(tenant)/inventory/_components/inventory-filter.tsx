"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Package, Settings2 } from "lucide-react";
import { StockAdjustDialog } from "./stock-adjust-dialog";

export type SerializedInventoryProduct = {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
};

type ProductWithVariants = SerializedInventoryProduct;

export function InventoryFilter({ products }: { products: ProductWithVariants[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [adjusting, setAdjusting] = useState<{ id: string; name: string; stockQuantity: number } | null>(null);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "low") return p.stockQuantity <= p.lowStockThreshold;
    if (filter === "out") return p.stockQuantity <= 0;
    return true;
  });

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
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="low">Low Stock</TabsTrigger>
            <TabsTrigger value="out">Out</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const isOut = p.stockQuantity <= 0;
                  const isLow = !isOut && p.stockQuantity <= p.lowStockThreshold;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-10 h-10 rounded object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.sku ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.stockQuantity}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.lowStockThreshold}
                      </TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="secondary">Low Stock</Badge>
                        ) : (
                          <Badge variant="outline">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAdjusting({ id: p.id, name: p.name, stockQuantity: p.stockQuantity })
                          }
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <StockAdjustDialog
        open={!!adjusting}
        onOpenChange={(open) => !open && setAdjusting(null)}
        product={adjusting}
      />
    </div>
  );
}
