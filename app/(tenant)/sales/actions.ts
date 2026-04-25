"use server";

import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createSale,
  updateSaleStatus,
  deleteSale,
  cancelSale,
  duplicateSale,
  type PaymentTerms,
  type SalePaymentSplit,
} from "@/lib/services/sale.service";
import { findOrCreateCustomerByNamePhone } from "@/lib/services/customer.service";
import {
  getCachedProducts,
  getCachedCustomers,
  getCachedPaymentMethods,
} from "@/lib/cache";
import { revalidatePath } from "next/cache";

// Distinct creators of sales in the current tenant. Drives the
// "All Users" dropdown in the TopBar — fetched lazily on first open
// of the popover to keep the layout server-render cheap.
export async function getSalesCreators() {
  const session = await requireTenant();
  const rows = await prisma.sale.findMany({
    where: { tenantId: session.tenantId, isDeleted: false, createdBy: { not: null } },
    distinct: ["createdBy"],
    select: { creator: { select: { id: true, fullName: true } } },
    take: 100,
  });
  return rows
    .map((r) => r.creator)
    .filter((c): c is { id: string; fullName: string } => !!c)
    .map((c) => ({ id: c.id, name: c.fullName }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Fetched lazily by the New Sale dialog when it first opens — avoids
// loading all products/customers on every page render.
export async function getNewSaleFormData() {
  const session = await requireTenant();
  const [products, customers, paymentMethods] = await Promise.all([
    getCachedProducts(session.tenantId),
    getCachedCustomers(session.tenantId),
    getCachedPaymentMethods(session.tenantId),
  ]);
  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      rate: Number(p.rate),
      stockQuantity: p.stockQuantity,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      whatsapp: c.whatsapp,
    })),
    paymentMethods: paymentMethods.map((m) => ({ id: m.id, name: m.name })),
  };
}

export async function createSaleAction(formData: FormData) {
  const session = await requireTenant();

  // Parse line items: items_<n>_productId, items_<n>_quantity, items_<n>_unitPrice
  const items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }> = [];

  const itemsJson = formData.get("itemsJson") as string;
  if (itemsJson) {
    try {
      const parsed = JSON.parse(itemsJson) as any[];
      for (const it of parsed) {
        if (it.productId && it.quantity && it.unitPrice >= 0) {
          items.push({
            productId: it.productId,
            variantId: it.variantId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          });
        }
      }
    } catch {
      throw new Error("Invalid item data");
    }
  }

  if (items.length === 0) throw new Error("Add at least one item to the sale");

  // saleDate (yyyy-mm-dd) overrides createdAt — used by the New Sale
  // dialog so back-dating / post-dating an entry works. Time-of-day is
  // copied from the current moment so the order within a day is sane.
  let saleDate: Date | undefined;
  const rawSaleDate = formData.get("saleDate") as string | null;
  if (rawSaleDate && /^\d{4}-\d{2}-\d{2}$/.test(rawSaleDate)) {
    const [y, m, d] = rawSaleDate.split("-").map(Number);
    const now = new Date();
    saleDate = new Date(
      y,
      m - 1,
      d,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    );
  }

  // Payment splits — multiple methods can each cover a portion of the
  // grand total. The form posts a JSON array; rows with amount <= 0 are
  // dropped server-side.
  let paymentSplits: SalePaymentSplit[] | undefined;
  const splitsJson = formData.get("paymentSplitsJson") as string | null;
  if (splitsJson) {
    try {
      const parsed = JSON.parse(splitsJson) as Array<{
        method?: unknown;
        amount?: unknown;
      }>;
      paymentSplits = parsed
        .map((s) => ({
          method: typeof s.method === "string" && s.method ? s.method : "cash",
          amount: Number(s.amount) || 0,
        }))
        .filter((s) => s.amount > 0);
      if (paymentSplits.length === 0) paymentSplits = undefined;
    } catch {
      throw new Error("Invalid payment splits");
    }
  }

  // Payment terms gate the credit-days / due-date fields. "credit" is
  // the only term where creditDays is meaningful.
  const rawTerms = (formData.get("paymentTerms") as string) || "immediate";
  const paymentTerms: PaymentTerms =
    rawTerms === "cod" || rawTerms === "credit" ? rawTerms : "immediate";

  let creditDays: number | undefined;
  if (paymentTerms === "credit") {
    const raw = formData.get("creditDays") as string | null;
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n > 0) creditDays = n;
  }

  const explicitAmountPaid = formData.get("amountPaid");
  const amountPaid =
    explicitAmountPaid !== null && explicitAmountPaid !== ""
      ? parseFloat(explicitAmountPaid as string)
      : undefined;

  // Customer resolution: an existing customerId wins. Otherwise, auto
  // match-or-create on (name + phone) so cashiers can type a returning
  // customer's details without picking from a dropdown and not produce
  // duplicate rows.
  const customerName = (formData.get("customerName") as string) || "";
  const customerPhone =
    (formData.get("customerPhone") as string) || undefined;
  const customerAddress =
    (formData.get("customerAddress") as string) || undefined;
  const customerWhatsapp =
    (formData.get("customerWhatsapp") as string) || undefined;
  const explicitCustomerId =
    (formData.get("customerId") as string) || undefined;

  const customerId =
    explicitCustomerId ||
    (customerName.trim()
      ? await findOrCreateCustomerByNamePhone(
          session.tenantId,
          session.userId,
          {
            name: customerName.trim(),
            phone: customerPhone,
            address: customerAddress,
            whatsapp: customerWhatsapp,
          }
        )
      : undefined);

  const sale = await createSale(session.tenantId, session.userId, {
    customerName,
    customerPhone,
    customerAddress,
    customerWhatsapp,
    customerId,
    paymentMethod: formData.get("paymentMethod") as string,
    paymentStatus: (formData.get("paymentStatus") as string) || undefined,
    discountAmount: formData.get("discountAmount")
      ? parseFloat(formData.get("discountAmount") as string)
      : 0,
    charge: formData.get("charge")
      ? parseFloat(formData.get("charge") as string)
      : 0,
    additionalInfo: (formData.get("additionalInfo") as string) || undefined,
    saleDate,
    paymentTerms,
    creditDays,
    paymentSplits,
    amountPaid,
    items,
  });

  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return sale;
}

export async function updateSaleStatusAction(formData: FormData) {
  const session = await requireTenant();
  await updateSaleStatus(session.tenantId, session.userId, {
    saleId: formData.get("saleId") as string,
    paymentStatus: (formData.get("paymentStatus") as string) || undefined,
    orderStatus: (formData.get("orderStatus") as string) || undefined,
    courierStatus: (formData.get("courierStatus") as string) || undefined,
    courierName: (formData.get("courierName") as string) || undefined,
    consignmentId: (formData.get("consignmentId") as string) || undefined,
    cnNumber: (formData.get("cnNumber") as string) || undefined,
    amountPaid: formData.get("amountPaid")
      ? parseFloat(formData.get("amountPaid") as string)
      : undefined,
  });
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/packaging");
  revalidatePath("/dashboard");
}

export async function deleteSaleAction(formData: FormData) {
  const session = await requireTenant();
  await deleteSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function duplicateSaleAction(formData: FormData) {
  const session = await requireTenant();
  const sale = await duplicateSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return sale;
}

// Bulk-set the courier status for several sales in one round trip.
// Used by the "Bulk Status" header control on the listing — the
// cashier checks several rows, picks a status, and applies.
export async function bulkUpdateCourierStatusAction(formData: FormData) {
  const session = await requireTenant();
  const idsRaw = (formData.get("saleIds") as string) ?? "";
  const courierStatus = (formData.get("courierStatus") as string) ?? "";
  if (!courierStatus) throw new Error("Courier status is required");
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error("Select at least one sale");
  for (const id of ids) {
    await updateSaleStatus(session.tenantId, session.userId, {
      saleId: id,
      courierStatus,
    });
  }
  revalidatePath("/sales");
  revalidatePath("/packaging");
}

export async function cancelSaleAction(formData: FormData) {
  const session = await requireTenant();
  await cancelSale(
    session.tenantId,
    session.userId,
    formData.get("saleId") as string
  );
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
