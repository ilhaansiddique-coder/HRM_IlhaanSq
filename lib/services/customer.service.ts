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
