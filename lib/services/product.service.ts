import { prisma } from "../db";
import { invalidateProductCache } from "../cache";

// ─── Types ──────────────────────────────────────────────────

export type CreateProductInput = {
  name: string;
  sku?: string;
  rate: number;
  cost?: number;
  minimumSalePrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  hasVariants?: boolean;
  imageUrl?: string;
  size?: string;
  color?: string;
  variants?: {
    sku?: string;
    attributes: Record<string, string>;
    rate?: number;
    cost?: number;
    stockQuantity?: number;
  }[];
};

export type UpdateProductInput = Partial<CreateProductInput> & { id: string };

// ─── Create ─────────────────────────────────────────────────

export async function createProduct(
  tenantId: string,
  userId: string,
  input: CreateProductInput
) {
  const product = await prisma.product.create({
    data: {
      tenantId,
      name: input.name,
      sku: input.sku,
      rate: input.rate,
      cost: input.cost,
      minimumSalePrice: input.minimumSalePrice,
      stockQuantity: input.stockQuantity ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 10,
      hasVariants: input.hasVariants ?? false,
      imageUrl: input.imageUrl,
      size: input.size,
      color: input.color,
      createdBy: userId,
      variants: input.variants
        ? {
            create: input.variants.map((v) => ({
              sku: v.sku,
              attributes: v.attributes,
              rate: v.rate,
              cost: v.cost,
              stockQuantity: v.stockQuantity ?? 0,
            })),
          }
        : undefined,
    },
    include: { variants: true },
  });

  await logActivity(tenantId, userId, "create", "product", product.id, {
    name: product.name,
  });

  await invalidateProductCache(tenantId);
  return product;
}

// ─── Update ─────────────────────────────────────────────────

export async function updateProduct(
  tenantId: string,
  userId: string,
  input: UpdateProductInput
) {
  // Verify the product belongs to this tenant
  const existing = await prisma.product.findFirst({
    where: { id: input.id, tenantId },
  });
  if (!existing) throw new Error("Product not found");

  const product = await prisma.product.update({
    where: { id: input.id },
    data: {
      name: input.name,
      sku: input.sku,
      rate: input.rate,
      cost: input.cost,
      minimumSalePrice: input.minimumSalePrice,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
      hasVariants: input.hasVariants,
      imageUrl: input.imageUrl,
      size: input.size,
      color: input.color,
    },
    include: { variants: true },
  });

  await logActivity(tenantId, userId, "update", "product", product.id, {
    name: product.name,
  });

  await invalidateProductCache(tenantId, product.id);
  return product;
}

// ─── Duplicate ──────────────────────────────────────────────

async function findUniqueName(
  tenantId: string,
  originalName: string
): Promise<string> {
  const base = originalName.replace(/\s*\(\d+\)$/, "");
  for (let n = 1; n < 500; n++) {
    const candidate = `${base} (${n})`;
    const existing = await prisma.product.findFirst({
      where: { tenantId, name: candidate, isDeleted: false },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Could not find a unique product name");
}

async function findUniqueSku(
  tenantId: string,
  originalSku: string | null
): Promise<string | null> {
  if (!originalSku) return null;
  const base = originalSku.replace(/\s*\(\d+\)$/, "");
  for (let n = 1; n < 500; n++) {
    const candidate = `${base} (${n})`;
    const existing = await prisma.product.findFirst({
      where: { tenantId, sku: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Could not find a unique SKU");
}

export async function duplicateProduct(
  tenantId: string,
  userId: string,
  productId: string
) {
  const original = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: { variants: true },
  });
  if (!original) throw new Error("Product not found");

  const [uniqueName, uniqueSku] = await Promise.all([
    findUniqueName(tenantId, original.name),
    findUniqueSku(tenantId, original.sku),
  ]);

  const copy = await prisma.product.create({
    data: {
      tenantId,
      name: uniqueName,
      sku: uniqueSku,
      rate: original.rate,
      cost: original.cost,
      minimumSalePrice: original.minimumSalePrice,
      stockQuantity: original.stockQuantity,
      lowStockThreshold: original.lowStockThreshold,
      hasVariants: original.hasVariants,
      imageUrl: original.imageUrl,
      size: original.size,
      color: original.color,
      createdBy: userId,
      variants: original.hasVariants && original.variants.length
        ? {
            create: original.variants.map((v) => ({
              sku: v.sku ? `${v.sku}-copy` : null,
              attributes: v.attributes as object,
              rate: v.rate,
              cost: v.cost,
              stockQuantity: v.stockQuantity,
              lowStockThreshold: v.lowStockThreshold,
              imageUrl: v.imageUrl,
            })),
          }
        : undefined,
    },
    include: { variants: true },
  });

  await logActivity(tenantId, userId, "create", "product", copy.id, {
    name: copy.name,
    duplicatedFrom: original.id,
  });

  await invalidateProductCache(tenantId);
  return copy;
}

// ─── Delete (soft) ──────────────────────────────────────────

export async function deleteProduct(
  tenantId: string,
  userId: string,
  productId: string
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });
  if (!existing) throw new Error("Product not found");

  const product = await prisma.product.update({
    where: { id: productId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await logActivity(tenantId, userId, "delete", "product", productId, {
    name: product.name,
  });

  await invalidateProductCache(tenantId, productId);
  return product;
}

// ─── Restore (undo soft delete) ─────────────────────────────

export async function restoreProduct(
  tenantId: string,
  userId: string,
  productId: string
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenantId, isDeleted: true },
  });
  if (!existing) throw new Error("Product not found in trash");

  const product = await prisma.product.update({
    where: { id: productId },
    data: { isDeleted: false, deletedAt: null },
  });

  await logActivity(tenantId, userId, "restore", "product", productId, {
    name: product.name,
  });

  await invalidateProductCache(tenantId, productId);
  return product;
}

// ─── Hard delete (permanent) ────────────────────────────────
// Cascade is handled by Prisma's onDelete: Cascade on the variants
// relation. SaleItem rows reference productId nullable (no cascade) so
// historical sales still resolve their snapshots; the product row itself
// disappears for good.

export async function hardDeleteProduct(
  tenantId: string,
  userId: string,
  productId: string
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, name: true },
  });
  if (!existing) throw new Error("Product not found");

  await prisma.product.delete({ where: { id: productId } });

  await logActivity(tenantId, userId, "hard_delete", "product", productId, {
    name: existing.name,
  });

  await invalidateProductCache(tenantId, productId);
}

// ─── Stock Adjustment ───────────────────────────────────────

export async function adjustStock(
  tenantId: string,
  userId: string,
  productId: string,
  quantity: number,
  type: "in" | "out" | "adjustment",
  reason?: string,
  variantId?: string
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true },
  });
  if (!existing) throw new Error("Product not found");

  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });
    if (!variant) throw new Error("Variant does not belong to this product");
  }

  const delta = type === "out" ? -Math.abs(quantity) : Math.abs(quantity);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: delta } },
    });

    if (variantId) {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { increment: delta } },
      });
    }

    await tx.inventoryLog.create({
      data: {
        tenantId,
        productId,
        variantId,
        type,
        quantity: Math.abs(quantity),
        reason,
        createdBy: userId,
      },
    });
  });

  await invalidateProductCache(tenantId, productId);
}

// ─── Activity Logger ────────────────────────────────────────

async function logActivity(
  tenantId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.activityLog.create({
      data: {
        tenantId,
        userId,
        action,
        entityType,
        entityId,
        details: (details as any) ?? undefined,
      },
    });
  } catch {
    // Activity logging should never break the main flow
  }
}
