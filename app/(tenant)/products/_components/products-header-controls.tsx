"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StockFilter = "all" | "in" | "low" | "out";

// Search + Stock filter rendered inside the TopBar's left slot when the
// user is on /products. State lives in the URL (`q` and `stock` query
// params) so it stays in sync with the ProductList component below —
// typing here filters the list, and changing the dropdown also updates
// any header-mirrored controls.
export function ProductsHeaderControls() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlStock = (params.get("stock") as StockFilter) ?? "all";

  const [searchInput, setSearchInput] = useState(urlQ);

  // Mirror URL → input when other code (or back/forward) changes it.
  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  // Mirror input → URL on a debounce so we don't thrash router.replace.
  useEffect(() => {
    if (searchInput === urlQ) return;
    const id = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (searchInput) p.set("q", searchInput);
      else p.delete("q");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
  }, [searchInput, urlQ, params, router]);

  function setStock(next: StockFilter) {
    const p = new URLSearchParams(params.toString());
    if (next === "all") p.delete("stock");
    else p.set("stock", next);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        {/* Search icon — explicit z-index so it always paints above the
            input's background; foreground/60 colour so it's visible on
            both light and night themes. */}
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
        />
        <Input
          type="text"
          placeholder="Search products, SKU, or..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-72 rounded-lg pl-9"
        />
      </div>
      {/* shadcn Select uses Radix Popover under the hood — comes with a
          nice fade+slide-in animation, full keyboard support, and looks
          consistent with the rest of the app. */}
      <Select
        value={urlStock}
        onValueChange={(v) => setStock(v as StockFilter)}
      >
        <SelectTrigger className="h-9 w-32 rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stock</SelectItem>
          <SelectItem value="in">In Stock</SelectItem>
          <SelectItem value="low">Low Stock</SelectItem>
          <SelectItem value="out">Out of Stock</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
