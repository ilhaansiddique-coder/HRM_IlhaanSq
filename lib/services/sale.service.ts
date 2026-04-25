import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { invalidateSaleCache, invalidateProductCache } from "../cache";

// ─── Types ──────────────────────────────────────────────────

export type CreateSaleInput = {
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerWhatsapp?: string;
  customerId?: string;
  paymentMethod: string;
  paymentStatus?: string;
  discountPercent?: number;
  discountAmount?: number;
  charge?: number;
  additionalInfo?: string;
  /** Optional override for the sale's createdAt; defaults to now(). */
  saleDate?: Date;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }[];
};

export type UpdateSaleStatusInput = {
  saleId: string;
  paymentStatus?: string;
  orderStatus?: string;
  courierStatus?: string;
  courierName?: string;
  consignmentId?: string;
  cnNumber?: string;
  amountPaid?: number;
};

// ─── Invoice Number Generator ───────────────────────────────

async function generateInvoiceNumber(
  tenantId: string,
  prefix: string = "INV"
): Promise<string> {
  const lastSale = await prisma.sale.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (lastSale?.invoiceNumber) {
    const numPart = lastSale.invoiceNumber.replace(prefix, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

// ─── Create Sale ────────────────────────────────────────────

export async function createSale(
  tenantId: string,
  userId: string,
  input: CreateSaleInput
) {
  if (input.items.length === 0) throw new Error("Sale has no items");

  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const variantIds = Array.from(
    new Set(input.items.map((i) => i.variantId).filter(Boolean) as string[])
  );

  const [ownedProducts, ownedVariants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isDeleted: false },
      select: { id: true },
    }),
    variantIds.length
      ? prisma.productVariant.findMany({
          where: {
            id: { in: variantIds },
            product: { tenantId, isDeleted: false },
          },
          select: { id: true, productId: true },
        })
      : Promise.resolve([] as { id: string; productId: string }[]),
  ]);

  const ownedProductSet = new Set(ownedProducts.map((p) => p.id));
  const ownedVariantMap = new Map(ownedVariants.map((v) => [v.id, v.productId]));

  for (const item of input.items) {
    if (!ownedProductSet.has(item.productId)) {
      throw new Error("Product does not belong to this tenant");
    }
    if (item.variantId) {
      const parentId = ownedVariantMap.get(item.variantId);
      if (!parentId || parentId !== item.productId) {
        throw new Error("Variant does not belong to this product/tenant");
      }
    }
  }

  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const discountAmount = input.discountAmount ?? 0;
  const charge = input.charge ?? 0;
  const grandTotal = subtotal - discountAmount + charge;

  const sale = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumberTx(tx, tenantId);

    const created = await tx.sale.create({
      data: {
        tenantId,
        invoiceNumber,
        customerId: input.customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress,
        customerWhatsapp: input.customerWhatsapp,
        subtotal,
        discountPercent: input.discountPercent ?? 0,
        discountAmount,
        charge,
        grandTotal,
        totalAmount: grandTotal,
        amountDue: grandTotal,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus ?? "pending",
        additionalInfo: input.additionalInfo,
        createdBy: userId,
        ...(input.saleDate ? { createdAt: input.saleDate } : {}),
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        items: { include: { product: true, variant: true } },
        customer: true,
      },
    });

    for (const item of input.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }
    }

    return created;
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);

  return sale;
}

async function generateInvoiceNumberTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  prefix: string = "INV"
): Promise<string> {
  const lastSale = await tx.sale.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (lastSale?.invoiceNumber) {
    const numPart = lastSale.invoiceNumber.replace(prefix, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

// ─── Update Sale Status ─────────────────────────────────────

export async function updateSaleStatus(
  tenantId: string,
  userId: string,
  input: UpdateSaleStatusInput
) {
  // Verify sale belongs to tenant
  const existing = await prisma.sale.findFirst({
    where: { id: input.saleId, tenantId },
    select: { grandTotal: true },
  });
  if (!existing) throw new Error("Sale not found");

  const updateData: Record<string, unknown> = {};
  if (input.paymentStatus !== undefined) updateData.paymentStatus = input.paymentStatus;
  if (input.orderStatus !== undefined) updateData.orderStatus = input.orderStatus;
  if (input.courierStatus !== undefined) updateData.courierStatus = input.courierStatus;
  if (input.courierName !== undefined) updateData.courierName = input.courierName;
  if (input.consignmentId !== undefined) updateData.consignmentId = input.consignmentId;
  if (input.cnNumber !== undefined) updateData.cnNumber = input.cnNumber;
  if (input.amountPaid !== undefined) {
    updateData.amountPaid = input.amountPaid;
    updateData.amountDue = Number(existing.grandTotal) - Number(input.amountPaid);
  }

  const sale = await prisma.sale.update({
    where: { id: input.saleId },
    data: updateData,
    include: {
      items: { include: { product: true, variant: true } },
      customer: true,
    },
  });

  await invalidateSaleCache(tenantId);
  return sale;
}

// ─── Delete Sale (soft) ─────────────────────────────────────

export async function deleteSale(
  tenantId: string,
  userId: string,
  saleId: string
) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      items: {
        include: {
          product: { select: { id: true, tenantId: true } },
          variant: { select: { id: true, product: { select: { tenantId: true } } } },
        },
      },
    },
  });
  if (!sale) throw new Error("Sale not found");

  await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      if (item.productId && item.product?.tenantId === tenantId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
      if (
        item.variantId &&
        item.variant?.product?.tenantId === tenantId
      ) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }

    await tx.sale.update({
      where: { id: saleId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
}
