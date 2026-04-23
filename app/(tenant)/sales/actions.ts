"use server";

import { requireTenant } from "@/lib/auth";
import {
  createSale,
  updateSaleStatus,
  deleteSale,
} from "@/lib/services/sale.service";
import { revalidatePath } from "next/cache";

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
