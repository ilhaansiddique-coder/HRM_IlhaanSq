"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Settings2 } from "lucide-react";
import { StockAdjustDialog } from "./stock-adjust-dialog";
import { MobileInventoryHeader } from "./mobile-inventory-header";

export type SerializedInventoryProduct = {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  tenantId: string;
  tenantName: string | null;
};

type StockFilter = "all" | "low" | "out";

export function InventoryFilter({
  products,
  showTenantColumn,
}: {
  products: SerializedInventoryProduct[];
  showTenantColumn: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // URL is the source of truth for search, stock filter, and tenant
  // filter — keeps this component synced with the InventoryHeaderControls
  // mounted in the global TopBar (and with MobileInventoryHeader).
  const search = params.get("q") ?? "";
  const filter = (params.get("stock") as StockFilter) ?? "all";
  const tenantFilter = params.get("tenant") ?? "all";

  function setTenantFilter(next: string) {
    const p = new URLSearchParams(params.toString());
    if (next === "all") p.delete("tenant");
    else p.set("tenant", next);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  const [adjusting, setAdjusting] = useState<{
    id: string;
    name: string;
    stockQuantity: number;
    tenantName: string | null;
  } | null>(null);

  // Distinct tenant list for the tenant-filter dropdown (super-admin view).
  const tenantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) {
      if (p.tenantName && !seen.has(p.tenantId)) {
        seen.set(p.tenantId, p.tenantName);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (
        tenantFilter !== "all" &&
        showTenantColumn &&
        p.tenantId !== tenantFilter
      ) {
        return false;
      }
      if (q) {
        const hit =
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filter === "low") return p.stockQuantity <= p.lowStockThreshold;
      if (filter === "out") return p.stockQuantity <= 0;
      return true;
    });
  }, [products, search, filter, tenantFilter, showTenantColumn]);

  return (
    <div className="space-y-4">
      {/* Mobile-only header — title + Stock filter + 4 quick cards.
          Desktop uses the global TopBar (InventoryHeaderControls +
          ProductsActionsCluster) for the equivalent affordances. */}
      <MobileInventoryHeader />

      {/* Tenant filter — extra control for super admins. Visible on
          every breakpoint since the TopBar mirror only carries
          search + stock filter (matching the products page header). */}
      {showTenantColumn && tenantOptions.length > 0 && (
        <div className="flex justify-end">
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="h-9 w-full sm:w-48 rounded-lg">
              <SelectValue placeholder="All Tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="pl-3">
                All Tenants
              </SelectItem>
              {tenantOptions.map((t) => (
                <SelectItem key={t.id} value={t.id} className="pl-3">
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                {showTenantColumn && <TableHead>Tenant</TableHead>}
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showTenantColumn ? 7 : 6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const isOut = p.stockQuantity <= 0;
                  const isLow =
                    !isOut && p.stockQuantity <= p.lowStockThreshold;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.sku ?? "-"}
                      </TableCell>
                      {showTenantColumn && (
                        <TableCell className="text-xs">
                          <Badge
                            variant="secondary"
                            className="rounded-lg font-normal"
                          >
                            {p.tenantName ?? "—"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {p.stockQuantity}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.lowStockThreshold}
                      </TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge variant="destructive" className="rounded-lg">
                            Out of Stock
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="secondary" className="rounded-lg">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-lg">
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAdjusting({
                              id: p.id,
                              name: p.name,
                              stockQuantity: p.stockQuantity,
                              tenantName: p.tenantName,
                            })
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
