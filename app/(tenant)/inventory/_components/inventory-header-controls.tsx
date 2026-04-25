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

type StockFilter = "all" | "low" | "out";

// Search + Stock filter rendered inside the TopBar's left slot when the
// user is on /inventory. Mirrors the layout used for /products. State
// lives in URL query params so the in-page InventoryFilter (which keeps
// extra controls like the per-tenant filter) stays synced — typing here
// filters the table below.
export function InventoryHeaderControls() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlStock = (params.get("stock") as StockFilter) ?? "all";

  const [searchInput, setSearchInput] = useState(urlQ);

  // URL → input mirror (back/forward, other code editing the URL)
  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  // input → URL (debounced) so we don't thrash router.replace per keystroke
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
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
        />
        <Input
          type="text"
          placeholder="Search products..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-72 rounded-lg pl-9"
        />
      </div>

      <Select
        value={urlStock}
        onValueChange={(v) => setStock(v as StockFilter)}
      >
        <SelectTrigger className="h-9 w-32 rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="pl-3">
            All Stock
          </SelectItem>
          <SelectItem value="low" className="pl-3">
            Low Stock
          </SelectItem>
          <SelectItem value="out" className="pl-3">
            Out of Stock
          </SelectItem>
        </SelectContent>
      </Select>

    </div>
  );
}
