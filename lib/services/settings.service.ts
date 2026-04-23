import { prisma } from "../db";
import { invalidateSettingsCache } from "../cache";

export type UpdateBusinessSettingsInput = {
  businessName?: string;
  invoicePrefix?: string;
  logoUrl?: string | null;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  brandColor?: string;
  invoiceFooterMessage?: string;
  lowStockAlertQuantity?: number;
};

export type UpdateSystemSettingsInput = {
  currencySymbol?: string;
  currencyCode?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
};

export async function updateBusinessSettings(
  tenantId: string,
  input: UpdateBusinessSettingsInput
) {
  const settings = await prisma.businessSettings.upsert({
    where: { tenantId },
    update: input,
    create: { tenantId, businessName: input.businessName ?? "Business", ...input },
  });
  await invalidateSettingsCache(tenantId);
  return settings;
}

export async function updateSystemSettings(
  tenantId: string,
  input: UpdateSystemSettingsInput
) {
  const settings = await prisma.systemSettings.upsert({
    where: { tenantId },
    update: input,
    create: { tenantId, ...input },
  });
  await invalidateSettingsCache(tenantId);
  return settings;
}

export async function createPaymentMethod(tenantId: string, name: string) {
  const method = await prisma.paymentMethod.create({
    data: { tenantId, name, isActive: true },
  });
  await invalidateSettingsCache(tenantId);
  return method;
}

export async function togglePaymentMethod(
  tenantId: string,
  id: string,
  isActive: boolean
) {
  const existing = await prisma.paymentMethod.findFirst({
    where: { id, tenantId },
  });
  if (!existing) throw new Error("Payment method not found");

  const method = await prisma.paymentMethod.update({
    where: { id },
    data: { isActive },
  });
  await invalidateSettingsCache(tenantId);
  return method;
}

export async function deletePaymentMethod(tenantId: string, id: string) {
  const existing = await prisma.paymentMethod.findFirst({
    where: { id, tenantId },
  });
  if (!existing) throw new Error("Payment method not found");

  await prisma.paymentMethod.delete({ where: { id } });
  await invalidateSettingsCache(tenantId);
}
