import { prisma } from "../db";
import { invalidateSettingsCache } from "../cache";

export type UpdateBusinessSettingsInput = {
  businessName?: string;
  logoUrl?: string | null;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  brandColor?: string;
};

export type UpdateSystemSettingsInput = {
  currencySymbol?: string;
  currencyCode?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  lateThreshold?: string | null;
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
