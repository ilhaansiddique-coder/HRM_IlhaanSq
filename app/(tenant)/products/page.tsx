import { requireTenant } from "@/lib/auth";
import { getCachedProducts } from "@/lib/cache";
import {
  ProductList,
  type ProductStats,
  type SerializedProduct,
} from "./_components/product-list";

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function ProductsPage() {
  const session = await requireTenant();
  const products = await getCachedProducts(session.tenantId);

  const serialized: SerializedProduct[] = products.map((p) => {
    const rate = toNumber(p.rate) ?? 0;
    const cost = toNumber(p.cost);

    const variants = p.variants.map((v) => ({
      id: v.id,
      attributes: (v.attributes ?? {}) as Record<string, string>,
      sku: v.sku,
      stockQuantity: v.stockQuantity,
      lowStockThreshold: v.lowStockThreshold,
      rate: toNumber(v.rate),
      cost: toNumber(v.cost),
      imageUrl: v.imageUrl,
    }));

    const attributeDefs = (p.attributes ?? []).map((a) => ({
      name: a.name,
      values: a.values.map((v) => v.value),
    }));

    const totalStock = p.hasVariants
      ? variants.reduce((sum, v) => sum + v.stockQuantity, 0)
      : p.stockQuantity;

    const totalValue = p.hasVariants
      ? variants.reduce((sum, v) => {
          const unit = v.cost ?? v.rate ?? cost ?? rate ?? 0;
          return sum + v.stockQuantity * unit;
        }, 0)
      : p.stockQuantity * (cost ?? rate);

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      rate,
      cost,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      hasVariants: p.hasVariants,
      imageUrl: p.imageUrl,
      size: p.size,
      color: p.color,
      variants,
      attributeDefs,
      totalStock,
      totalValue,
    };
  });

  const stats: ProductStats = {
    totalItems: serialized.length,
    totalStock: serialized.reduce((s, p) => s + p.totalStock, 0),
    lowStockCount: serialized.filter(
      (p) => p.totalStock > 0 && p.totalStock <= p.lowStockThreshold
    ).length,
    outOfStockCount: serialized.filter((p) => p.totalStock <= 0).length,
    totalValue: serialized.reduce((s, p) => s + p.totalValue, 0),
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <ProductList initialProducts={serialized} stats={stats} />
    </div>
  );
}
