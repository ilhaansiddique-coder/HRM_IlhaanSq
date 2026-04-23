"use server";

import { requireTenant } from "@/lib/auth";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/services/customer.service";
import { revalidatePath } from "next/cache";

function parseInput(formData: FormData) {
  return {
    name: formData.get("name") as string,
    phone: (formData.get("phone") as string) || undefined,
    email: (formData.get("email") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    whatsapp: (formData.get("whatsapp") as string) || undefined,
    creditLimit: formData.get("creditLimit")
      ? parseFloat(formData.get("creditLimit") as string)
      : undefined,
    additionalInfo: (formData.get("additionalInfo") as string) || undefined,
  };
}

export async function createCustomerAction(formData: FormData) {
  const session = await requireTenant();
  await createCustomer(session.tenantId, session.userId, parseInput(formData));
  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireTenant();
  await updateCustomer(session.tenantId, session.userId, {
    id: formData.get("customerId") as string,
    ...parseInput(formData),
  });
  revalidatePath("/customers");
}

export async function deleteCustomerAction(formData: FormData) {
  const session = await requireTenant();
  await deleteCustomer(
    session.tenantId,
    session.userId,
    formData.get("customerId") as string
  );
  revalidatePath("/customers");
  revalidatePath("/dashboard");
}
