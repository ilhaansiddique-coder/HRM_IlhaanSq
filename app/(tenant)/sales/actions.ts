"use server";

import { requireTenant } from "@/lib/auth";
import {
  createSale,
  updateSaleStatus,
  deleteSale,
} from "@/lib/services/sale.service";
import {
  getCachedProducts,
  getCachedCustomers,
  getCachedPaymentMethods,
} from "@/lib/cache";
import { revalidatePath } from "next/cache";

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

  const sale = await createSale(session.tenantId, session.userId, {
    customerName: formData.get("customerName") as string,
    customerPhone: (formData.get("customerPhone") as string) || undefined,
    customerAddress: (formData.get("customerAddress") as string) || undefined,
    customerWhatsapp: (formData.get("customerWhatsapp") as string) || undefined,
    customerId: (formData.get("customerId") as string) || undefined,
    paymentMethod: formData.get("paymentMethod") as string,
    paymentStatus: (formData.get("paymentStatus") as string) || "pending",
    discountAmount: formData.get("discountAmount")
      ? parseFloat(formData.get("discountAmount") as string)
      : 0,
    charge: formData.get("charge")
      ? parseFloat(formData.get("charge") as string)
      : 0,
    additionalInfo: (formData.get("additionalInfo") as string) || undefined,
    saleDate,
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
