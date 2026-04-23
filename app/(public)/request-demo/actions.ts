"use server";

import { createDemoRequest } from "@/lib/services/demo-request.service";

export async function submitDemoRequestAction(formData: FormData) {
  return createDemoRequest({
    fullName: formData.get("fullName") as string,
    businessName: formData.get("businessName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    businessType: formData.get("businessType") as string,
    requestedSlug: (formData.get("requestedSlug") as string) || undefined,
    requestedPlan: (formData.get("requestedPlan") as string) || "starter",
    message: (formData.get("message") as string) || undefined,
  });
}
