"use server";

import { requireTenant } from "@/lib/auth";
import {
  updateBusinessSettings,
  updateSystemSettings,
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
  seedDefaultPaymentMethods,
  type PaymentMethodWriteInput,
} from "@/lib/services/settings.service";
import { revalidatePath } from "next/cache";

type Terms = NonNullable<PaymentMethodWriteInput["defaultTerms"]>;
type Behavior = NonNullable<PaymentMethodWriteInput["defaultPaidBehavior"]>;
type FeeType = NonNullable<PaymentMethodWriteInput["feeType"]>;

function parsePaymentMethodForm(formData: FormData): PaymentMethodWriteInput {
  const terms = formData.get("defaultTerms") as string | null;
  const behavior = formData.get("defaultPaidBehavior") as string | null;
  const feeType = formData.get("feeType") as string | null;
  const feeValueRaw = formData.get("feeValue") as string | null;
  const sortRaw = formData.get("sortOrder") as string | null;
  return {
    name: ((formData.get("name") as string) ?? "").trim(),
    type: (formData.get("type") as string) || undefined,
    defaultTerms:
      terms === "immediate" || terms === "cod" || terms === "credit"
        ? (terms as Terms)
        : undefined,
    defaultPaidBehavior:
      behavior === "full" || behavior === "zero" || behavior === "custom"
        ? (behavior as Behavior)
        : undefined,
    feeType:
      feeType === "none" || feeType === "fixed" || feeType === "percent"
        ? (feeType as FeeType)
        : undefined,
    feeValue:
      feeValueRaw && feeValueRaw.trim() !== ""
        ? Number(feeValueRaw)
        : undefined,
    sortOrder:
      sortRaw && sortRaw.trim() !== "" ? parseInt(sortRaw, 10) : undefined,
    isActive: formData.get("isActive")
      ? formData.get("isActive") === "true"
      : undefined,
  };
}

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
  const input = parsePaymentMethodForm(formData);
  if (!input.name) return;
  await createPaymentMethod(session.tenantId, input);
  revalidatePath("/settings");
}

export async function updatePaymentMethodAction(formData: FormData) {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  // Patch shape — only fields actually present in the form get sent.
  await updatePaymentMethod(session.tenantId, id, parsePaymentMethodForm(formData));
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

export async function seedDefaultPaymentMethodsAction() {
  const session = await requireTenant();
  const result = await seedDefaultPaymentMethods(session.tenantId);
  revalidatePath("/settings");
  return result;
}
