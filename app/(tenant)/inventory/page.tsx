import { requireTenant } from "@/lib/auth";
import { getInventoryProducts } from "@/lib/services/product.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle } from "lucide-react";
import {
  InventoryFilter,
  type SerializedInventoryProduct,
} from "./_components/inventory-filter";
import { MobileInventoryHeader } from "./_components/mobile-inventory-header";

export default async function InventoryPage() {
  const session = await requireTenant();

  // Super admin: cross-tenant inventory (tenantName populated per row).
  // Tenant user: their own tenant's products only.
  const scope = session.isSuperAdmin ? null : session.tenantId;
  const products = await getInventoryProducts(scope);

  const serialized: SerializedInventoryProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stockQuantity: p.stockQuantity,
    lowStockThreshold: p.lowStockThreshold,
    imageUrl: p.imageUrl,
    tenantId: p.tenantId,
    tenantName: p.tenantName,
  }));

  const totalUnits = serialized.reduce((sum, p) => sum + p.stockQuantity, 0);
  const lowStock = serialized.filter((p) => p.stockQuantity <= p.lowStockThreshold);
  const outOfStock = serialized.filter((p) => p.stockQuantity <= 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile-only header — title + Stock filter + 4 quick cards.
          Sits at the top of the page, above the StatCards, mirroring
          how MobileProductsHeader is positioned on /products. */}
      <MobileInventoryHeader />

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

      <InventoryFilter
        products={serialized}
        showTenantColumn={session.isSuperAdmin}
      />
    </div>
  );
}
