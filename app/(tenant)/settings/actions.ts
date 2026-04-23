"use server";

import { requireTenant } from "@/lib/auth";
import {
  updateBusinessSettings,
  updateSystemSettings,
  createPaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
} from "@/lib/services/settings.service";
import { revalidatePath } from "next/cache";

export async function saveBusinessSettings(formData: FormData) {
  const session = await requireTenant();
  // logoUrl is present in the form if the upload widget is used (or emptied).
  const hasLogoField = formData.has("logoUrl");
  const rawLogoUrl = formData.get("logoUrl") as string | null;

  await updateBusinessSettings(session.tenantId, {
    businessName: formData.get("businessName") as string,
    invoicePrefix: formData.get("invoicePrefix") as string,
    phone: (formData.get("phone") as string) || undefined,
    whatsapp: (formData.get("whatsapp") as string) || undefined,
    email: (formData.get("email") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    brandColor: (formData.get("brandColor") as string) || undefined,
    invoiceFooterMessage: (formData.get("invoiceFooterMessage") as string) || undefined,
    lowStockAlertQuantity: formData.get("lowStockAlertQuantity")
      ? parseInt(formData.get("lowStockAlertQuantity") as string, 10)
      : undefined,
    ...(hasLogoField ? { logoUrl: rawLogoUrl ? rawLogoUrl : null } : {}),
  });
  revalidatePath("/settings");
  revalidatePath("/invoices");
}

export async function saveSystemSettings(formData: FormData) {
  const session = await requireTenant();
  await updateSystemSettings(session.tenantId, {
    currencySymbol: formData.get("currencySymbol") as string,
    currencyCode: formData.get("currencyCode") as string,
    timezone: formData.get("timezone") as string,
    dateFormat: formData.get("dateFormat") as string,
    timeFormat: formData.get("timeFormat") as string,
  });
  revalidatePath("/settings");
}

export async function addPaymentMethodAction(formData: FormData) {
  const session = await requireTenant();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  await createPaymentMethod(session.tenantId, name);
  revalidatePath("/settings");
}

export async function togglePaymentMethodAction(formData: FormData) {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";
  await togglePaymentMethod(session.tenantId, id, isActive);
  revalidatePath("/settings");
}

export async function deletePaymentMethodAction(formData: FormData) {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  await deletePaymentMethod(session.tenantId, id);
  revalidatePath("/settings");
}
