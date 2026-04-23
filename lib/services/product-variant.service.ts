import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { invalidateProductCache } from "../cache";

export type VariantAttributes = Record<string, string>;

export type VariantInput = {
  attributes: VariantAttributes;
  sku?: string | null;
  rate?: number | null;
  cost?: number | null;
  stockQuantity: number;
  lowStockThreshold?: number | null;
  imageUrl?: string | null;
};

export type AttributeInput = { name: string; values: string[] };

export type UpsertVariantsInput = {
  productId: string;
  hasVariants: boolean;
  attributes: AttributeInput[];
  variants: VariantInput[];
};

function normalizeAttrsKey(a: VariantAttributes): string {
  const keys = Object.keys(a).sort();
  const ordered: VariantAttributes = {};
  for (const k of keys) ordered[k] = a[k];
  return JSON.stringify(ordered);
}

function normalizeAttrName(n: string): string {
  return n.toLowerCase().trim();
}

export async function upsertProductVariants(
  tenantId: string,
  input: UpsertVariantsInput
) {
  const owned = await prisma.product.findFirst({
    where: { id: input.productId, tenantId },
    select: { id: true },
  });
  if (!owned) throw new Error("Product not found");

  const cleanAttributes = input.attributes
    .map((a) => ({
      name: a.name.trim(),
      values: Array.from(new Set(a.values.map((v) => v.trim()).filter(Boolean))),
    }))
    .filter((a) => a.name.length > 0);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: input.productId },
      data: {
        hasVariants: input.hasVariants,
        ...(input.hasVariants ? { color: null, size: null } : {}),
      },
    });

    const existingAttrs = await tx.productAttribute.findMany({
      where: { productId: input.productId },
      include: { values: true },
    });
    const existingAttrByKey = new Map(
      existingAttrs.map((a) => [normalizeAttrName(a.name), a])
    );

    const desiredKeys = new Set(cleanAttributes.map((a) => normalizeAttrName(a.name)));
    const attrsToDelete = existingAttrs.filter(
      (a) => !desiredKeys.has(normalizeAttrName(a.name))
    );
    if (attrsToDelete.length) {
      await tx.productAttribute.deleteMany({
        where: { id: { in: attrsToDelete.map((a) => a.id) } },
      });
    }

    for (const a of cleanAttributes) {
      const key = normalizeAttrName(a.name);
      let attrRow = existingAttrByKey.get(key);
      if (!attrRow) {
        attrRow = await tx.productAttribute.create({
          data: { productId: input.productId, name: a.name },
          include: { values: true },
        });
      }

      const existingVals = new Set(attrRow.values.map((v) => v.value));
      const desiredVals = new Set(a.values);

      const valsToDelete = attrRow.values.filter((v) => !desiredVals.has(v.value));
      if (valsToDelete.length) {
        await tx.productAttributeValue.deleteMany({
          where: { id: { in: valsToDelete.map((v) => v.id) } },
        });
      }

      const valsToAdd = a.values.filter((v) => !existingVals.has(v));
      if (valsToAdd.length) {
        await tx.productAttributeValue.createMany({
          data: valsToAdd.map((v) => ({ attributeId: attrRow!.id, value: v })),
        });
      }
    }

    const existingVariants = await tx.productVariant.findMany({
      where: { productId: input.productId },
    });
    const existingByKey = new Map(
      existingVariants.map((v) => [
        normalizeAttrsKey((v.attributes ?? {}) as VariantAttributes),
        v,
      ])
    );

    const desiredVariants = input.hasVariants
      ? dedupeByKey(input.variants)
      : [];
    const desiredByKey = new Map(
      desiredVariants.map((v) => [normalizeAttrsKey(v.attributes), v])
    );

    const orphanIds = existingVariants
      .filter(
        (v) =>
          !desiredByKey.has(normalizeAttrsKey((v.attributes ?? {}) as VariantAttributes))
      )
      .map((v) => v.id);
    if (orphanIds.length) {
      await tx.productVariant.deleteMany({ where: { id: { in: orphanIds } } });
    }

    for (const v of desiredVariants) {
      const key = normalizeAttrsKey(v.attributes);
      const existing = existingByKey.get(key);
      const data: Prisma.ProductVariantUncheckedCreateInput = {
        productId: input.productId,
        attributes: v.attributes as Prisma.InputJsonValue,
        sku: v.sku ?? null,
        rate: v.rate ?? null,
        cost: v.cost ?? null,
        stockQuantity: v.stockQuantity ?? 0,
        lowStockThreshold: v.lowStockThreshold ?? null,
        imageUrl: v.imageUrl ?? null,
      };
      if (existing) {
        await tx.productVariant.update({ where: { id: existing.id }, data });
      } else {
        await tx.productVariant.create({ data });
      }
    }

    if (input.hasVariants && desiredVariants.length) {
      const total = desiredVariants.reduce((s, v) => s + (v.stockQuantity ?? 0), 0);
      await tx.product.update({
        where: { id: input.productId },
        data: { stockQuantity: total },
      });
    }
  });

  await invalidateProductCache(tenantId, input.productId);
}

function dedupeByKey(list: VariantInput[]): VariantInput[] {
  const map = new Map<string, VariantInput>();
  for (const v of list) map.set(normalizeAttrsKey(v.attributes), v);
  return Array.from(map.values());
}

export async function clearProductVariants(tenantId: string, productId: string) {
  const owned = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true },
  });
  if (!owned) throw new Error("Product not found");

  await prisma.$transaction(async (tx) => {
    await tx.productVariant.deleteMany({ where: { productId } });
    await tx.productAttribute.deleteMany({ where: { productId } });
    await tx.product.update({
      where: { id: productId },
      data: { hasVariants: false },
    });
  });

  await invalidateProductCache(tenantId, productId);
}
