"use server";

import { requireTenant } from "@/lib/auth";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  restoreProduct,
  hardDeleteProduct,
} from "@/lib/services/product.service";
import { ensureCategory } from "@/lib/services/product-category.service";
import { buildSku, parseStyleFromSku } from "@/lib/sku";
import {
  adjustStockSchema,
  createProductSchema,
  deleteProductSchema,
  duplicateProductSchema,
  updateProductSchema,
} from "@/lib/validation/products";
import { revalidatePath } from "next/cache";

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") obj[k] = v;
  }
  return obj;
}

export async function createProductAction(formData: FormData) {
  const session = await requireTenant();
  const parsed = createProductSchema.parse(formToObject(formData));

  const clientSku = parsed.sku || "";
  const color = parsed.color || "";
  const size = parsed.size || "";

  let finalSku: string | undefined = clientSku || undefined;
  if (parsed.categoryLabel) {
    const cat = await ensureCategory(session.tenantId, session.userId, {
      code: parsed.categoryCode || undefined,
      label: parsed.categoryLabel,
    });
    const styleNumber = parseStyleFromSku(clientSku, cat.code) ?? 1;
    finalSku = buildSku({ category: cat.code, style: styleNumber, color, size });
  }

  const product = await createProduct(session.tenantId, session.userId, {
    name: parsed.name,
    sku: finalSku,
    rate: parsed.rate,
    cost: parsed.cost,
    stockQuantity: parsed.stockQuantity ?? 0,
    imageUrl: parsed.imageUrl || undefined,
    color: color || undefined,
    size: size || undefined,
  });
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { id: product.id };
}

export async function updateProductAction(formData: FormData) {
  const session = await requireTenant();
  const parsed = updateProductSchema.parse(formToObject(formData));

  const product = await updateProduct(session.tenantId, session.userId, {
    id: parsed.productId,
    name: parsed.name,
    sku: parsed.sku || undefined,
    rate: parsed.rate,
    cost: parsed.cost,
    stockQuantity: parsed.stockQuantity,
    imageUrl: parsed.imageUrl || undefined,
    color: parsed.color || undefined,
    size: parsed.size || undefined,
  });
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { id: product.id };
}

export async function deleteProductAction(formData: FormData) {
  const session = await requireTenant();
  const { productId } = deleteProductSchema.parse(formToObject(formData));
  await deleteProduct(session.tenantId, session.userId, productId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function duplicateProductAction(formData: FormData) {
  const session = await requireTenant();
  const { productId } = duplicateProductSchema.parse(formToObject(formData));
  await duplicateProduct(session.tenantId, session.userId, productId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function restoreProductAction(formData: FormData) {
  const session = await requireTenant();
  const { productId } = deleteProductSchema.parse(formToObject(formData));
  await restoreProduct(session.tenantId, session.userId, productId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function hardDeleteProductAction(formData: FormData) {
  const session = await requireTenant();
  const { productId } = deleteProductSchema.parse(formToObject(formData));
  await hardDeleteProduct(session.tenantId, session.userId, productId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

// ─── Inventory Stock Adjustment ─────────────────────────────

import { adjustStock } from "@/lib/services/product.service";
import { getCachedProducts } from "@/lib/cache";
import { prisma } from "@/lib/db";

export async function adjustStockAction(formData: FormData) {
  const session = await requireTenant();
  const parsed = adjustStockSchema.parse(formToObject(formData));

  // Super admin: resolve the product's actual tenantId so cross-tenant
  // adjustments work. The adjustStock service validates the product
  // belongs to the tenantId we pass; using session.tenantId for a super
  // admin acting on another workspace would fail that check.
  let actingTenantId = session.tenantId;
  if (session.isSuperAdmin) {
    const product = await prisma.product.findUnique({
      where: { id: parsed.productId },
      select: { tenantId: true },
    });
    if (!product) throw new Error("Product not found");
    actingTenantId = product.tenantId;
  }

  await adjustStock(
    actingTenantId,
    session.userId,
    parsed.productId,
    parsed.quantity,
    parsed.type,
    parsed.reason || undefined
  );
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

// Lightweight product picker options for the AdjustStockDialog and
// similar UI affordances. Fetched on demand so the data isn't shipped
// to every page.
//
// Super admin gets a cross-tenant list (each row tagged with its tenant
// name); regular tenant users get just their own tenant's products.
export async function getProductPickerOptions(): Promise<
  Array<{
    id: string;
    name: string;
    sku: string | null;
    stockQuantity: number;
    tenantName: string | null;
  }>
> {
  const session = await requireTenant();
  if (session.isSuperAdmin) {
    const rows = await prisma.product.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stockQuantity: p.stockQuantity,
      tenantName: p.tenant?.name ?? null,
    }));
  }
  const products = await getCachedProducts(session.tenantId);
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stockQuantity: p.stockQuantity,
    tenantName: null,
  }));
}

// CSV-string export of the tenant's catalogue. Returned to the client
// where it's wrapped in a Blob and triggered as a download.
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportProductsCsvAction(): Promise<{ csv: string }> {
  const session = await requireTenant();
  const products = await getCachedProducts(session.tenantId);

  const header = [
    "name",
    "sku",
    "rate",
    "cost",
    "stock_quantity",
    "low_stock_threshold",
    "size",
    "color",
    "image_url",
    "has_variants",
  ];
  const rows = products.map((p) =>
    [
      csvEscape(p.name),
      csvEscape(p.sku),
      csvEscape(Number(p.rate)),
      csvEscape(p.cost === null ? "" : Number(p.cost)),
      csvEscape(p.stockQuantity),
      csvEscape(p.lowStockThreshold),
      csvEscape(p.size),
      csvEscape(p.color),
      csvEscape(p.imageUrl),
      csvEscape(p.hasVariants ? "true" : "false"),
    ].join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  return { csv };
}
