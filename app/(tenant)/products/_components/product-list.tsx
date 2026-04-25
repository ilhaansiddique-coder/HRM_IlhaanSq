"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Boxes,
  Download,
  Package,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useCurrency } from "../../_components/providers";
import { ProductDialog } from "./product-dialog";
import { ProductCard } from "./product-card";

export type SerializedVariant = {
  id: string;
  attributes: Record<string, string>;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number | null;
  rate: number | null;
  cost: number | null;
  imageUrl: string | null;
};

export type SerializedAttribute = {
  name: string;
  values: string[];
};

export type SerializedProduct = {
  id: string;
  name: string;
  sku: string | null;
  rate: number;
  cost: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  imageUrl: string | null;
  size: string | null;
  color: string | null;
  variants: SerializedVariant[];
  attributeDefs: SerializedAttribute[];
  totalStock: number;
  totalValue: number;
  // Cross-tenant: tagged on every row when the viewer is a super
  // admin so the card can show which workspace owns the product.
  // Null on tenant-scoped reads.
  tenantId: string;
  tenantName: string | null;
};

export type ProductStats = {
  totalItems: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
};

type StockFilter = "all" | "in" | "low" | "out";

export function ProductList({
  initialProducts,
  stats,
  showTenantBadge = false,
}: {
  initialProducts: SerializedProduct[];
  stats: ProductStats;
  showTenantBadge?: boolean;
}) {
  const { formatAmount } = useCurrency();
  const router = useRouter();
  const params = useSearchParams();

  // Search & filter live in the URL so they stay in sync with the
  // ProductsHeaderControls in the TopBar (and survive browser back/forward).
  // Search uses a local input buffer that pushes to the URL on a small
  // debounce — typing stays instant; cross-component sync happens within ~250ms.
  const urlQ = params.get("q") ?? "";
  const urlStock = (params.get("stock") as StockFilter) ?? "all";

  const [searchInput, setSearchInput] = useState(urlQ);
  const filter = urlStock;

  // Pull URL changes back into the input (e.g. when the TopBar
  // search input is what the user typed into).
  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  // Push the input value to the URL on a debounce so other consumers
  // (e.g. the TopBar header controls) reflect the same value.
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

  function setFilter(next: StockFilter) {
    const p = new URLSearchParams(params.toString());
    if (next === "all") p.delete("stock");
    else p.set("stock", next);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  // Aliases so the rest of the component reads the same names as before.
  const search = searchInput;
  const setSearch = setSearchInput;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SerializedProduct | null>(null);

  function openCreate() {
    setEditingProduct(null);
    setDialogOpen(true);
  }
  function openEdit(p: SerializedProduct) {
    setEditingProduct(p);
    setDialogOpen(true);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialProducts.filter((p) => {
      if (q) {
        const hit =
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.tenantName?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filter === "all") return true;
      if (filter === "out") return p.totalStock <= 0;
      if (filter === "low")
        return p.totalStock > 0 && p.totalStock <= p.lowStockThreshold;
      if (filter === "in") return p.totalStock > p.lowStockThreshold;
      return true;
    });
  }, [initialProducts, search, filter]);

  return (
    <div className="space-y-4">
      {/* Mobile-only Products header — title + filter + 4 quick cards.
          Hidden on md+ where the existing toolbar below covers the
          same controls. */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StockFilter)}
            style={{ color: "#AEAEAF", borderColor: "#AEAEAF" }}
            className="h-9 w-28 rounded-lg border bg-background pl-3 pr-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#AEAEAF]/30"
          >
            <option value="all" style={{ color: "#AEAEAF" }}>
              All Stock
            </option>
            <option value="in" style={{ color: "#AEAEAF" }}>
              In Stock
            </option>
            <option value="low" style={{ color: "#AEAEAF" }}>
              Low Stock
            </option>
            <option value="out" style={{ color: "#AEAEAF" }}>
              Out of Stock
            </option>
          </select>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <ActionCard
            icon={<Download className="h-4 w-4" />}
            label="Import"
            onClick={() => toast.info("Import is coming soon.")}
          />
          <ActionCard
            icon={<Upload className="h-4 w-4" />}
            label="Export"
            onClick={() => toast.info("Export is coming soon.")}
          />
          <ActionCardLink
            icon={<Archive className="h-4 w-4" />}
            label="Stock"
            href="/inventory"
          />
          <ActionCard
            icon={<Plus className="h-4 w-4" />}
            label="Add"
            onClick={openCreate}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Products"
          value={stats.totalStock.toLocaleString()}
          sublabel="Combined stock quantity"
          icon={<Boxes className="h-4 w-4" />}
        />
        <StatCard
          label="Total Items"
          value={stats.totalItems.toLocaleString()}
          sublabel="Parent products only"
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="Low Stock Items"
          value={stats.lowStockCount.toLocaleString()}
          sublabel="Needs restocking"
          icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
          accent="warning"
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStockCount.toLocaleString()}
          sublabel="Urgent restocking"
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          accent="danger"
        />
        <StatCard
          label="Total Value"
          value={formatAmount(stats.totalValue)}
          sublabel="Current inventory value"
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        />
      </div>

      {/* Mobile-only search input. The desktop toolbar that used to live
          here is gone — search + filter + Add Product moved to the
          page-aware TopBar (ProductsHeaderControls + ProductsActionsCluster). */}
      <div className="md:hidden">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
          />
          <Input
            type="text"
            placeholder="Search products, SKU, or..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Package className="h-8 w-8 opacity-40" />
          <span className="text-sm">No products found</span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={openEdit}
              showTenantBadge={showTenantBadge}
            />
          ))}
        </div>
      )}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={
          editingProduct
            ? {
                id: editingProduct.id,
                name: editingProduct.name,
                sku: editingProduct.sku,
                rate: editingProduct.rate,
                cost: editingProduct.cost,
                stockQuantity: editingProduct.stockQuantity,
                lowStockThreshold: editingProduct.lowStockThreshold,
                imageUrl: editingProduct.imageUrl,
                size: editingProduct.size,
                color: editingProduct.color,
                hasVariants: editingProduct.hasVariants,
                variants: editingProduct.variants,
                attributeDefs: editingProduct.attributeDefs,
              }
            : undefined
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: "warning" | "danger";
}) {
  const valueClass =
    accent === "danger"
      ? "text-destructive"
      : accent === "warning"
        ? "text-amber-500"
        : "text-foreground";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{sublabel}</div>
    </Card>
  );
}

// ─── Mobile-only quick-action card helpers ───
const cardClasses =
  "flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-3 text-foreground transition-colors active:bg-muted/40 hover:bg-muted/30";

function ActionCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
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
  icon: React.ReactNode;
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
