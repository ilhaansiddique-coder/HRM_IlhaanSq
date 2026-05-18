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

// ─── Payment method helpers ─────────────────────────────────

const CORE_PAYMENT_METHOD_KEYS = new Set([
  "cash",
  "bkash",
  "nagad",
  "ibbl",
  "brac_bank",
  "dbbl",
  "city_bank",
  "al_arafah",
  "cod",
  "credit",
]);

/**
 * Slugify a method's name into a stable `key`. The key is what the
 * sale form looks up for `defaultTerms` / `defaultPaidBehavior` and
 * what the customer-payment service uses for credit detection — never
 * change a method's key after sales reference it (only `name` is safe
 * to rename).
 */
export function normalizePaymentMethodKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type PaymentMethodWriteInput = {
  name: string;
  type?: string;
  defaultTerms?: "immediate" | "cod" | "credit";
  defaultPaidBehavior?: "full" | "zero" | "custom";
  feeType?: "none" | "fixed" | "percent";
  feeValue?: number | null;
  sortOrder?: number;
  isActive?: boolean;
};

export async function createPaymentMethod(
  tenantId: string,
  input: PaymentMethodWriteInput
) {
  if (!input.name?.trim()) throw new Error("Name is required");

  // Auto-slug `key` from `name`. If a row with the same key already
  // exists for this tenant, bail with a clear error rather than letting
  // the unique constraint surface as a Prisma error.
  const key = normalizePaymentMethodKey(input.name);
  if (!key) throw new Error("Name must contain at least one letter or digit");
  const collision = await prisma.paymentMethod.findFirst({
    where: { tenantId, key },
    select: { id: true },
  });
  if (collision) {
    throw new Error(`Payment method with key "${key}" already exists`);
  }

  const method = await prisma.paymentMethod.create({
    data: {
      tenantId,
      name: input.name.trim(),
      key,
      type: input.type ?? "cash",
      defaultTerms: input.defaultTerms ?? "immediate",
      defaultPaidBehavior: input.defaultPaidBehavior ?? "full",
      feeType: input.feeType ?? "none",
      feeValue: input.feeValue ?? null,
      sortOrder: input.sortOrder ?? 50,
      isActive: input.isActive ?? true,
    },
  });
  await invalidateSettingsCache(tenantId);
  return method;
}

export async function updatePaymentMethod(
  tenantId: string,
  id: string,
  patch: Partial<PaymentMethodWriteInput>
) {
  const existing = await prisma.paymentMethod.findFirst({
    where: { id, tenantId },
  });
  if (!existing) throw new Error("Payment method not found");

  // `key` is intentionally not patchable — historical sales reference
  // it as a plain text string (`sales.payment_method`), and renaming
  // would orphan them. Only `name` (the human label) can be renamed.
  const method = await prisma.paymentMethod.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.defaultTerms !== undefined ? { defaultTerms: patch.defaultTerms } : {}),
      ...(patch.defaultPaidBehavior !== undefined ? { defaultPaidBehavior: patch.defaultPaidBehavior } : {}),
      ...(patch.feeType !== undefined ? { feeType: patch.feeType } : {}),
      ...(patch.feeValue !== undefined ? { feeValue: patch.feeValue } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
  });
  await invalidateSettingsCache(tenantId);
  return method;
}

/** Back-compat shim — older call sites pass just `(tenantId, id, isActive)`. */
export async function togglePaymentMethod(
  tenantId: string,
  id: string,
  isActive: boolean
) {
  return updatePaymentMethod(tenantId, id, { isActive });
}

export async function deletePaymentMethod(tenantId: string, id: string) {
  const existing = await prisma.paymentMethod.findFirst({
    where: { id, tenantId },
  });
  if (!existing) throw new Error("Payment method not found");

  // Note: previously blocked deletion of the canonical 10 keys
  // (cash/bkash/nagad/.../credit). That guard was removed at user
  // request — admins can now delete any method, including core ones.
  // The "Core" badge in the admin UI still surfaces which methods
  // the seed function will re-create, and historical sale rows that
  // reference a deleted method's key by string are not affected
  // (sales.payment_method is plain text, not an FK).
  await prisma.paymentMethod.delete({ where: { id } });
  await invalidateSettingsCache(tenantId);
}

// ─── Seed canonical 10 payment methods ──────────────────────
// Idempotent — only creates rows whose `key` doesn't already exist
// for the tenant. Safe to call from a "Seed defaults" button or from
// tenant provisioning.

const DEFAULT_PAYMENT_METHODS: Array<
  PaymentMethodWriteInput & { key: string }
> = [
  { key: "cash",      name: "Cash",      type: "cash",   defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 1 },
  { key: "bkash",     name: "Bkash",     type: "mobile", defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 2 },
  { key: "nagad",     name: "Nagad",     type: "mobile", defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 3 },
  { key: "ibbl",      name: "IBBL",      type: "bank",   defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 10 },
  { key: "brac_bank", name: "Brac Bank", type: "bank",   defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 11 },
  { key: "dbbl",      name: "DBBL",      type: "bank",   defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 12 },
  { key: "city_bank", name: "City Bank", type: "bank",   defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 13 },
  { key: "al_arafah", name: "Al Arafah", type: "bank",   defaultTerms: "immediate", defaultPaidBehavior: "full", sortOrder: 14 },
  { key: "cod",       name: "COD",       type: "cod",    defaultTerms: "cod",       defaultPaidBehavior: "zero", sortOrder: 90 },
  { key: "credit",    name: "Credit",    type: "credit", defaultTerms: "credit",    defaultPaidBehavior: "zero", sortOrder: 99 },
];

export async function seedDefaultPaymentMethods(tenantId: string) {
  const existing = await prisma.paymentMethod.findMany({
    where: { tenantId },
    select: { key: true },
  });
  const haveKeys = new Set(existing.map((m) => m.key).filter(Boolean));
  const toCreate = DEFAULT_PAYMENT_METHODS.filter((m) => !haveKeys.has(m.key));
  if (toCreate.length === 0) {
    return { created: 0, alreadyPresent: existing.length };
  }
  await prisma.paymentMethod.createMany({
    data: toCreate.map((m) => ({
      tenantId,
      name: m.name,
      key: m.key,
      type: m.type ?? "cash",
      defaultTerms: m.defaultTerms ?? "immediate",
      defaultPaidBehavior: m.defaultPaidBehavior ?? "full",
      feeType: "none",
      sortOrder: m.sortOrder ?? 50,
      isActive: true,
    })),
  });
  await invalidateSettingsCache(tenantId);
  return { created: toCreate.length, alreadyPresent: existing.length };
}
