"use server";

import { requireTenant } from "@/lib/auth";
import {
  clearProductVariants,
  upsertProductVariants,
  type UpsertVariantsInput,
} from "@/lib/services/product-variant.service";
import { revalidatePath } from "next/cache";

export async function upsertProductVariantsAction(
  payload: Omit<UpsertVariantsInput, never>
) {
  const session = await requireTenant();
  await upsertProductVariants(session.tenantId, payload);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function clearProductVariantsAction(productId: string) {
  const session = await requireTenant();
  await clearProductVariants(session.tenantId, productId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
