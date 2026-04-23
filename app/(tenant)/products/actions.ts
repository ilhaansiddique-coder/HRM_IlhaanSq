"use server";

import { requireTenant } from "@/lib/auth";
import { createProduct, updateProduct, deleteProduct, duplicateProduct } from "@/lib/services/product.service";
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

// ─── Inventory Stock Adjustment ─────────────────────────────

import { adjustStock } from "@/lib/services/product.service";

export async function adjustStockAction(formData: FormData) {
  const session = await requireTenant();
  const parsed = adjustStockSchema.parse(formToObject(formData));

  await adjustStock(
    session.tenantId,
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
