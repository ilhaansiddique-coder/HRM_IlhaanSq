import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { invalidateSaleCache, invalidateProductCache } from "../cache";

// ─── Types ──────────────────────────────────────────────────

export type PaymentTerms = "immediate" | "cod" | "credit";

export type SalePaymentSplit = {
  method: string;
  amount: number;
};

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
  /** Optional explicit amountPaid; otherwise inferred from splits or terms. */
  amountPaid?: number;
  /** Payment terms: immediate (default), cod (collect on delivery), credit (pay later). */
  paymentTerms?: PaymentTerms;
  /** Days from sale date until payment is due (only meaningful when paymentTerms === "credit"). */
  creditDays?: number;
  /** Split payments — multiple methods can pay portions of one sale. */
  paymentSplits?: SalePaymentSplit[];
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

// ─── Catalog read (cross-tenant, super admin) ───────────────
// Same payload shape as the per-tenant cached fetcher in lib/cache.ts
// (sales + items + customer + creator + payments) but spans every
// tenant and tags each row with the owning tenant's name. Not cached
// — super admin reads are infrequent and per-tenant cache
// invalidation wouldn't cover this key cleanly.
export type SaleWithTenant = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true; variant: true } };
    customer: true;
    creator: { select: { id: true; fullName: true; email: true } };
    payments: true;
    tenant: { select: { name: true } };
  };
}>;

export async function getAllTenantsSales(): Promise<SaleWithTenant[]> {
  return prisma.sale.findMany({
    where: { isDeleted: false },
    include: {
      items: { include: { product: true, variant: true } },
      customer: true,
      creator: { select: { id: true, fullName: true, email: true } },
      payments: true,
      tenant: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

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

  const paymentTerms: PaymentTerms = input.paymentTerms ?? "immediate";

  // Splits drive amountPaid when present. Otherwise fall back to the
  // explicit amountPaid input, then to the term default:
  //   immediate → fully paid
  //   cod / credit → unpaid (collected later)
  const splits = (input.paymentSplits ?? [])
    .map((s) => ({ method: s.method || "cash", amount: Number(s.amount) || 0 }))
    .filter((s) => s.amount > 0);
  const splitsTotal = splits.reduce((s, x) => s + x.amount, 0);

  let amountPaid: number;
  if (splitsTotal > 0) {
    amountPaid = splitsTotal;
  } else if (typeof input.amountPaid === "number") {
    amountPaid = input.amountPaid;
  } else {
    amountPaid = paymentTerms === "immediate" ? grandTotal : 0;
  }
  amountPaid = Math.min(Math.max(0, amountPaid), grandTotal);
  const amountDue = Math.max(0, grandTotal - amountPaid);

  const paymentStatus =
    input.paymentStatus ??
    (amountDue === 0 ? "paid" : amountPaid > 0 ? "partial" : "pending");

  const baseDate = input.saleDate ?? new Date();
  const dueDate =
    paymentTerms === "credit" && input.creditDays && input.creditDays > 0
      ? new Date(baseDate.getTime() + input.creditDays * 24 * 60 * 60 * 1000)
      : null;

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
        amountPaid,
        amountDue,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        paymentTerms,
        creditDays: paymentTerms === "credit" ? input.creditDays ?? null : null,
        dueDate,
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
        ...(splits.length > 0
          ? {
              payments: {
                create: splits.map((s) => ({
                  method: s.method,
                  amount: s.amount,
                })),
              },
            }
          : {}),
      },
      include: {
        items: { include: { product: true, variant: true } },
        customer: true,
        payments: true,
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

// ─── Cancel Sale (keeps row visible, restores stock once) ───
// Different from deleteSale: the sale row stays in the listing with
// paymentStatus = "cancelled" so revenue/customer history reflect the
// cancellation. Inventory is restored exactly once — the
// `inventoryRestored` flag guards against double-restoration if cancel
// is invoked twice (e.g. by a webhook race or repeated admin clicks).

export async function cancelSale(
  tenantId: string,
  userId: string,
  saleId: string
) {
  void userId;
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

  if (sale.paymentStatus === "cancelled" && sale.inventoryRestored) {
    return sale;
  }

  await prisma.$transaction(async (tx) => {
    if (!sale.inventoryRestored) {
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
    }

    await tx.sale.update({
      where: { id: saleId },
      data: {
        paymentStatus: "cancelled",
        cancelledAt: new Date(),
        inventoryRestored: true,
      },
    });
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
}

// ─── Duplicate Sale ─────────────────────────────────────────
// Re-runs createSale with the items + customer + payment shape of an
// existing sale. The new row gets its own invoice number, default
// "pending" payment status, and decrements stock again — so it acts
// like a real new sale for inventory accounting. The duplicate copies
// the original's discount/charge/method so the cashier can edit the
// new draft and submit, without retyping line items.

export async function duplicateSale(
  tenantId: string,
  userId: string,
  saleId: string
) {
  const original = await prisma.sale.findFirst({
    where: { id: saleId, tenantId, isDeleted: false },
    include: { items: true, payments: true },
  });
  if (!original) throw new Error("Sale not found");

  return createSale(tenantId, userId, {
    customerName: original.customerName,
    customerPhone: original.customerPhone ?? undefined,
    customerAddress: original.customerAddress ?? undefined,
    customerWhatsapp: original.customerWhatsapp ?? undefined,
    customerId: original.customerId ?? undefined,
    paymentMethod: original.paymentMethod,
    discountAmount: Number(original.discountAmount ?? 0),
    discountPercent: Number(original.discountPercent ?? 0),
    charge: Number(original.charge ?? 0),
    paymentTerms: (original.paymentTerms as PaymentTerms) ?? "immediate",
    creditDays: original.creditDays ?? undefined,
    paymentSplits: original.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount ?? 0),
    })),
    items: original.items.map((it) => ({
      productId: it.productId!,
      variantId: it.variantId ?? undefined,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice ?? 0),
    })),
  });
}
