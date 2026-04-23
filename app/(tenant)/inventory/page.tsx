import { requireTenant } from "@/lib/auth";
import { getCachedProducts } from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle } from "lucide-react";
import {
  InventoryFilter,
  type SerializedInventoryProduct,
} from "./_components/inventory-filter";

export default async function InventoryPage() {
  const session = await requireTenant();
  const products = await getCachedProducts(session.tenantId);

  const serialized: SerializedInventoryProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stockQuantity: p.stockQuantity,
    lowStockThreshold: p.lowStockThreshold,
    imageUrl: p.imageUrl,
  }));

  const totalUnits = serialized.reduce((sum, p) => sum + p.stockQuantity, 0);
  const lowStock = serialized.filter((p) => p.stockQuantity <= p.lowStockThreshold);
  const outOfStock = serialized.filter((p) => p.stockQuantity <= 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock levels across {serialized.length} products
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalUnits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-warning/35 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-warning">{lowStock.length}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/35 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{outOfStock.length}</div>
          </CardContent>
        </Card>
      </div>

      <InventoryFilter products={serialized} />
    </div>
  );
}
