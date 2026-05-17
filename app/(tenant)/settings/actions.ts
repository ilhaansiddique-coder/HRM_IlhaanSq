"use server";

import { requireTenant } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { checkRate } from "@/lib/rate-limit";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadBusinessLogoAction(
  formData: FormData
): Promise<{ url: string; error?: string }> {
  const session = await requireTenant();

  const role = session.role;
  if (!["owner", "admin", "superadmin"].includes(role ?? "")) {
    return { url: "", error: "Only admins can change the business logo." };
  }

  const hdrs = await headers();
  const xf = hdrs.get("x-forwarded-for");
  const ip = xf ? xf.split(",")[0].trim() : hdrs.get("x-real-ip") ?? "unknown";

  const rate = await checkRate("upload", `logo:${session.tenantId}:${ip}`);
  if (!rate.allowed) {
    return { url: "", error: `Too many uploads. Try again in ${rate.retryAfterSec}s.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { url: "", error: "No file provided" };
  if (!LOGO_ALLOWED_MIME.has(file.type)) {
    return { url: "", error: "Unsupported image type. Use JPG, PNG, WebP, or SVG." };
  }
  if (file.size > LOGO_MAX_BYTES) return { url: "", error: "Logo too large (max 2MB)." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const publicId = `rahedeen/${session.tenantId}/logo-${randomUUID()}`;

  const uploadResult = await new Promise<{ secure_url: string } | undefined>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "rahedeen/logos",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as { secure_url: string } | undefined);
        }
      );
      stream.end(bytes);
    }
  );

  if (!uploadResult) {
    return { url: "", error: "Could not save the logo. Please try again." };
  }

  return { url: uploadResult.secure_url };
}
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
