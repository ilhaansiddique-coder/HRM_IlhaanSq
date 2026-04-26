import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
  invalidateSaleCache,
  invalidateProductCache,
  invalidateCustomerCache,
} from "../cache";

// ─── Customer auto-status helper ────────────────────────────
// active = purchased ≤30d ago, neutral = ≤90d, inactive otherwise.
// Cancelled / soft-deleted sales don't count toward "last purchase".
// Called inside the same transaction as the sale mutation so the
// status is consistent with the sale change that triggered it.
async function recomputeCustomerStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  customerId: string | null | undefined
): Promise<void> {
  if (!customerId) return;
  const last = await tx.sale.findFirst({
    where: {
      tenantId,
      customerId,
      isDeleted: false,
      paymentStatus: { not: "cancelled" },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  let status: "active" | "neutral" | "inactive" = "inactive";
  if (last) {
    const days =
      (Date.now() - last.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    status = days <= 30 ? "active" : days <= 90 ? "neutral" : "inactive";
  }
  await tx.customer.update({
    where: { id: customerId },
    data: { status, lastPurchaseDate: last?.createdAt ?? null },
  });
}

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

  // Tier-3 credit-limit enforcement: a sale with credit terms (or any
  // amountDue > 0 against a credit-bearing method) can't push the
  // customer past their `creditLimit`. We compute existing outstanding
  // credit (sum of amountDue on credit-eligible non-cancelled sales)
  // + this new sale's contribution and refuse if it tops the limit.
  // Skipped when the customer has no creditLimit set (NULL).
  if (input.customerId && amountDue > 0 && paymentTerms !== "immediate") {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { creditLimit: true, name: true },
    });
    if (customer?.creditLimit) {
      const existing = await prisma.sale.aggregate({
        where: {
          tenantId,
          customerId: input.customerId,
          isDeleted: false,
          paymentTerms: "credit",
          amountDue: { gt: 0 },
          courierStatus: { notIn: ["cancelled", "returned", "lost"] },
        },
        _sum: { amountDue: true },
      });
      const existingDue = Number(existing._sum.amountDue ?? 0);
      const limit = Number(customer.creditLimit);
      if (existingDue + amountDue > limit) {
        throw new Error(
          `Credit limit exceeded for ${customer.name}. ` +
            `Limit ${limit.toFixed(2)}, already owes ${existingDue.toFixed(2)}, ` +
            `this sale would add ${amountDue.toFixed(2)}.`
        );
      }
    }
  }

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
        // Mirror so audit reads (COALESCE(review, original)) see the
        // live numbers from creation. recordCustomerPayment keeps them
        // in lock-step on every collection / reversal.
        reviewAmountPaid: amountPaid,
        reviewAmountDue: amountDue,
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

    // Refresh the customer's auto-status so a new purchase flips a
    // dormant customer back to "active" without a separate cron job.
    await recomputeCustomerStatus(tx, tenantId, created.customerId);

    return created;
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
  if (sale.customerId) await invalidateCustomerCache(tenantId);

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
// Stock is restored once and only once across the whole sale
// lifecycle. The `inventoryRestored` flag is the single source of
// truth: cancelSale, markSaleReturned, markSaleLost, and deleteSale
// all consult it to decide whether to add stock back. Without this
// guard, "cancel then delete" would double-restore.

export async function deleteSale(
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
        isDeleted: true,
        deletedAt: new Date(),
        inventoryRestored: true,
      },
    });

    await recomputeCustomerStatus(tx, tenantId, sale.customerId);
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
  if (sale.customerId) await invalidateCustomerCache(tenantId);
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
        statusChangedAt: new Date(),
        inventoryRestored: true,
      },
    });

    await recomputeCustomerStatus(tx, tenantId, sale.customerId);
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
  if (sale.customerId) await invalidateCustomerCache(tenantId);
}

// ─── Returned / Lost lifecycle ──────────────────────────────
// Same once-only stock-restore pattern as cancelSale. The only
// difference is which timestamp column gets set and what payment
// status the row carries afterwards. Inventory is restored exactly
// once across the whole lifecycle (guarded by `inventoryRestored`).

type LifecycleTransition = "returned" | "lost";

async function applyLifecycleTransition(
  tenantId: string,
  saleId: string,
  transition: LifecycleTransition
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

  const stamp = new Date();

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
        courierStatus: transition,
        statusChangedAt: stamp,
        inventoryRestored: true,
        ...(transition === "returned" ? { returnedAt: stamp } : { lostAt: stamp }),
      },
    });

    await recomputeCustomerStatus(tx, tenantId, sale.customerId);
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
  if (sale.customerId) await invalidateCustomerCache(tenantId);
}

export async function markSaleReturned(
  tenantId: string,
  userId: string,
  saleId: string
) {
  void userId;
  await applyLifecycleTransition(tenantId, saleId, "returned");
}

export async function markSaleLost(
  tenantId: string,
  userId: string,
  saleId: string
) {
  void userId;
  await applyLifecycleTransition(tenantId, saleId, "lost");
}

// ─── Hard delete (admin only) ───────────────────────────────
// Permanently removes the sale row. Cascades clean up sale_items
// and sale_payments via Prisma's onDelete: Cascade on those models.
// Stock is NOT touched here — a hard delete should only run after
// the sale was already cancelled/soft-deleted (which already
// restored stock) or never had stock impact (e.g., test data). If
// the sale is still active (not soft-deleted, not cancelled), we
// restore stock first to keep accounting consistent.

export async function hardDeleteSale(
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

    // Cascade delete via Prisma relations.
    await tx.sale.delete({ where: { id: saleId } });

    await recomputeCustomerStatus(tx, tenantId, sale.customerId);
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
  if (sale.customerId) await invalidateCustomerCache(tenantId);
}

// ─── Update Sale (full edit) ────────────────────────────────
// Re-opens an existing sale with new items, splits, customer info,
// totals, payment terms, etc. Stock is delta-corrected: old item
// quantities are restored, new item quantities are decremented,
// inside one transaction so a failure rolls back both. Tenant
// ownership is re-validated on every product/variant id supplied.
//
// The sale's `inventoryRestored` flag is reset to false here on the
// principle that "this sale now represents a fresh stock claim" —
// otherwise an edit-after-cancel would silently skip the new
// decrement. cancelledAt / returnedAt / lostAt are NOT touched
// (an edit doesn't undo a status); use updateSaleStatus or one of
// the lifecycle helpers for that.

export type UpdateSaleInput = {
  saleId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerWhatsapp?: string;
  customerId?: string | null;
  paymentMethod: string;
  paymentStatus?: string;
  discountPercent?: number;
  discountAmount?: number;
  charge?: number;
  additionalInfo?: string;
  saleDate?: Date;
  amountPaid?: number;
  paymentTerms?: PaymentTerms;
  creditDays?: number | null;
  paymentSplits?: SalePaymentSplit[];
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }[];
};

export async function updateSale(
  tenantId: string,
  userId: string,
  input: UpdateSaleInput
) {
  void userId;
  if (input.items.length === 0) throw new Error("Sale has no items");

  // Re-validate ownership of every product/variant on the new items.
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const variantIds = Array.from(
    new Set(input.items.map((i) => i.variantId).filter(Boolean) as string[])
  );

  const [ownedProducts, ownedVariants, existing] = await Promise.all([
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
    prisma.sale.findFirst({
      where: { id: input.saleId, tenantId },
      include: { items: true },
    }),
  ]);

  if (!existing) throw new Error("Sale not found");

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

  // Recompute totals (mirrors createSale).
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const discountAmount = input.discountAmount ?? 0;
  const charge = input.charge ?? 0;
  const grandTotal = subtotal - discountAmount + charge;
  const paymentTerms: PaymentTerms = input.paymentTerms ?? "immediate";

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

  const baseDate = input.saleDate ?? existing.createdAt;
  const dueDate =
    paymentTerms === "credit" && input.creditDays && input.creditDays > 0
      ? new Date(baseDate.getTime() + input.creditDays * 24 * 60 * 60 * 1000)
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    // Restore old item stock (delta-correction step 1).
    for (const old of existing.items) {
      if (old.productId) {
        await tx.product.update({
          where: { id: old.productId },
          data: { stockQuantity: { increment: old.quantity } },
        });
      }
      if (old.variantId) {
        await tx.productVariant.update({
          where: { id: old.variantId },
          data: { stockQuantity: { increment: old.quantity } },
        });
      }
    }

    // Replace items + payment splits atomically.
    await tx.saleItem.deleteMany({ where: { saleId: input.saleId } });
    await tx.salePayment.deleteMany({ where: { saleId: input.saleId } });

    const sale = await tx.sale.update({
      where: { id: input.saleId },
      data: {
        customerId: input.customerId ?? null,
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
        // Re-mirror on edit so any prior credit-collection adjustment
        // gets superseded — the new totals are authoritative.
        reviewAmountPaid: amountPaid,
        reviewAmountDue: amountDue,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        paymentTerms,
        creditDays: paymentTerms === "credit" ? input.creditDays ?? null : null,
        dueDate,
        additionalInfo: input.additionalInfo,
        // Edit re-claims stock, so reset the once-only restore guard.
        inventoryRestored: false,
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

    // Decrement stock for the new items (delta-correction step 2).
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

    await recomputeCustomerStatus(tx, tenantId, sale.customerId);

    return sale;
  });

  await invalidateSaleCache(tenantId);
  await invalidateProductCache(tenantId);
  if (updated.customerId) await invalidateCustomerCache(tenantId);

  return updated;
}

// ─── Get one sale with full payload (for view / edit dialogs) ───
export async function getSaleById(tenantId: string, saleId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      items: { include: { product: true, variant: true } },
      customer: true,
      creator: { select: { id: true, fullName: true, email: true } },
      payments: true,
    },
  });
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
