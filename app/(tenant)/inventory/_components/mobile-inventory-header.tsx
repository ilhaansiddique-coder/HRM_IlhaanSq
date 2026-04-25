"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Package, Settings2, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { exportProductsCsvAction } from "../../products/actions";
import { AdjustStockDialog } from "../../products/_components/adjust-stock-dialog";

type StockFilter = "all" | "low" | "out";

// Mobile-only header for /inventory. Mirrors MobileProductsHeader's
// shape so the mobile look is consistent across both pages.
//   Row 1: "Inventory" h1  +  Stock filter (URL-driven)
//   Row 2: 4 quick-action cards — Import, Export, Adjust, Products
export function MobileInventoryHeader() {
  const router = useRouter();
  const params = useSearchParams();
  const urlStock = (params.get("stock") as StockFilter) ?? "all";

  const [adjustOpen, setAdjustOpen] = useState(false);

  function setStock(next: StockFilter) {
    const p = new URLSearchParams(params.toString());
    if (next === "all") p.delete("stock");
    else p.set("stock", next);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  async function handleExport() {
    try {
      const { csv } = await exportProductsCsvAction();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Inventory exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export");
    }
  }

  return (
    <div className="md:hidden space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <Select
          value={urlStock}
          onValueChange={(v) => setStock(v as StockFilter)}
        >
          <SelectTrigger
            style={{ color: "#AEAEAF", borderColor: "#AEAEAF" }}
            className="h-9 w-28 rounded-lg border bg-background pl-3 pr-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEAEAF]/30"
          >
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

      <div className="grid grid-cols-4 gap-2">
        <ActionCard
          icon={<Upload className="h-4 w-4" />}
          label="Import"
          onClick={() => toast.info("Import is coming soon.")}
        />
        <ActionCard
          icon={<Download className="h-4 w-4" />}
          label="Export"
          onClick={handleExport}
        />
        <ActionCard
          icon={<Settings2 className="h-4 w-4" />}
          label="Adjust"
          onClick={() => setAdjustOpen(true)}
        />
        <ActionCardLink
          icon={<Package className="h-4 w-4" />}
          label="Products"
          href="/products"
        />
      </div>

      <AdjustStockDialog open={adjustOpen} onOpenChange={setAdjustOpen} />
    </div>
  );
}

const cardClasses =
  "flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-3 text-foreground transition-colors active:bg-muted/40 hover:bg-muted/30";

function ActionCard({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cardClasses}>
      <span className="text-foreground">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ActionCardLink({
  icon,
  label,
  href,
}: {
  icon: ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className={cardClasses}>
      <span className="text-foreground">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
