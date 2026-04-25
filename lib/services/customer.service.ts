import { prisma } from "../db";
import { invalidateCustomerCache } from "../cache";

// ─── Types ──────────────────────────────────────────────────

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  whatsapp?: string;
  tags?: string[];
  creditLimit?: number;
  additionalInfo?: string;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput> & { id: string };

// ─── Create ─────────────────────────────────────────────────

export async function createCustomer(
  tenantId: string,
  userId: string,
  input: CreateCustomerInput
) {
  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      whatsapp: input.whatsapp,
      tags: input.tags ?? [],
      creditLimit: input.creditLimit,
      additionalInfo: input.additionalInfo,
      status: "active",
      createdBy: userId,
    },
  });

  await invalidateCustomerCache(tenantId);
  return customer;
}

// ─── Match-or-create (used by sale flow) ───────────────────
// Sales create a customer on the fly when the cashier types a name and
// phone the system has not seen before. To avoid duplicate rows we
// match on phone first (most reliable: digits only, ignoring +88 etc),
// fall back to a normalized name when phone is missing, and only
// create a new customer when neither route lands.

const phoneDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const normalizeName = (s?: string | null) =>
  (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const buildWhatsappFromPhone = (phone?: string | null) => {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  return digits.startsWith("88") ? `+${digits}` : `+88${digits}`;
};

export async function findOrCreateCustomerByNamePhone(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    phone?: string;
    address?: string;
    whatsapp?: string;
  }
): Promise<string> {
  const digits = phoneDigits(input.phone);
  const normalized = normalizeName(input.name);

  // Phone match (digit-only equality on either phone or whatsapp).
  if (digits) {
    const candidates = await prisma.customer.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, phone: true, whatsapp: true },
      take: 200,
    });
    const hit = candidates.find(
      (c) => phoneDigits(c.phone) === digits || phoneDigits(c.whatsapp) === digits
    );
    if (hit) return hit.id;
  }

  // Name match (only when no phone — phone is the source of truth).
  if (!digits && normalized) {
    const candidates = await prisma.customer.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, name: true },
      take: 200,
    });
    const hit = candidates.find((c) => normalizeName(c.name) === normalized);
    if (hit) return hit.id;
  }

  // No match — create.
  const created = await prisma.customer.create({
    data: {
      tenantId,
      name: input.name,
      phone: input.phone || null,
      whatsapp: input.whatsapp || buildWhatsappFromPhone(input.phone),
      address: input.address || null,
      status: "active",
      createdBy: userId,
    },
    select: { id: true },
  });

  await invalidateCustomerCache(tenantId);
  return created.id;
}

// ─── Update ─────────────────────────────────────────────────

export async function updateCustomer(
  tenantId: string,
  userId: string,
  input: UpdateCustomerInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id: input.id, tenantId },
  });
  if (!existing) throw new Error("Customer not found");

  const customer = await prisma.customer.update({
    where: { id: input.id },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      whatsapp: input.whatsapp,
      tags: input.tags,
      creditLimit: input.creditLimit,
      additionalInfo: input.additionalInfo,
    },
  });

  await invalidateCustomerCache(tenantId);
  return customer;
}

// ─── Delete (soft) ──────────────────────────────────────────

export async function deleteCustomer(
  tenantId: string,
  userId: string,
  customerId: string
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!existing) throw new Error("Customer not found");

  await prisma.customer.update({
    where: { id: customerId },
    data: { isDeleted: true },
  });

  await invalidateCustomerCache(tenantId);
}
