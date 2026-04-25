"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Package, Search, Settings2 } from "lucide-react";
import { StockAdjustDialog } from "./stock-adjust-dialog";

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

  // ─── Mobile auto-complete ─────────────────────────────────
  // Local input buffer (debounces to URL ?q so URL stays canonical).
  // Suggestion popover opens on focus + while typing.
  const [searchInput, setSearchInput] = useState(search);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);

  // URL → input mirror (back/forward, TopBar typing on desktop)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // input → URL (debounced)
  useEffect(() => {
    if (searchInput === search) return;
    const id = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (searchInput) p.set("q", searchInput);
      else p.delete("q");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
  }, [searchInput, search, params, router]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        inputWrapRef.current &&
        !inputWrapRef.current.contains(e.target as Node)
      ) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const suggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, searchInput]);

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
      {/* Mobile-only auto-complete search. The MobileInventoryHeader
          itself now lives at the top of page.tsx; this input sits below
          it as the page heading's search affordance. Desktop uses the
          TopBar's InventoryHeaderControls for the same purpose. */}
      <div ref={inputWrapRef} className="md:hidden relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
        />
        <Input
          type="text"
          placeholder="Search products..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          className="pl-9 rounded-lg"
        />
        {suggestionsOpen && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-border/60 bg-popover shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchInput(s.name);
                  setSuggestionsOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.sku ?? "—"}
                    {showTenantColumn && s.tenantName
                      ? ` · ${s.tenantName}`
                      : ""}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.stockQuantity} in stock
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* Desktop: table view. Mobile uses the card list below. */}
      <Card className="hidden md:block overflow-hidden rounded-lg">
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

      {/* Mobile: same data as a card stack — no horizontal scroll, no
          truncated text. Each card shows the product image + name, then
          a small label/value grid for SKU / tenant / stock / threshold,
          a status badge, and an Adjust button at the foot. */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
            <span className="text-sm">No products found</span>
          </Card>
        ) : (
          filtered.map((p) => {
            const isOut = p.stockQuantity <= 0;
            const isLow =
              !isOut && p.stockQuantity <= p.lowStockThreshold;
            return (
              <Card key={p.id} className="rounded-lg p-3">
                <div className="flex items-start gap-3">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{p.name}</p>
                    {p.sku && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.sku}
                      </p>
                    )}
                  </div>
                  {isOut ? (
                    <Badge variant="destructive" className="rounded-lg">
                      Out
                    </Badge>
                  ) : isLow ? (
                    <Badge variant="secondary" className="rounded-lg">
                      Low
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-lg">
                      In Stock
                    </Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {showTenantColumn && p.tenantName && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Tenant: </span>
                      <span className="font-medium">{p.tenantName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">In Stock: </span>
                    <span className="font-semibold">{p.stockQuantity}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Threshold: </span>
                    <span className="font-medium">{p.lowStockThreshold}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full rounded-lg"
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
              </Card>
            );
          })
        )}
      </div>

      <StockAdjustDialog
        open={!!adjusting}
        onOpenChange={(open) => !open && setAdjusting(null)}
        product={adjusting}
      />
    </div>
  );
}
