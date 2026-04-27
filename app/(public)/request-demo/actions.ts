"use server";

import { createDemoRequest } from "@/lib/services/demo-request.service";

// Server Actions in Next.js production sanitise thrown Error.message
// to a generic "specific message is omitted in production builds…"
// string before it reaches the client. To surface validation errors
// (email already used, request already pending, etc.) verbatim to the
// user, we wrap the service call here and return the message in the
// payload — data isn't sanitised. `error: null` = success, `error:
// string` = failure with the original message intact.
export async function submitDemoRequestAction(
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    await createDemoRequest({
      fullName: formData.get("fullName") as string,
      businessName: formData.get("businessName") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      businessType: formData.get("businessType") as string,
      requestedSlug: (formData.get("requestedSlug") as string) || undefined,
      requestedPlan: (formData.get("requestedPlan") as string) || "starter",
      message: (formData.get("message") as string) || undefined,
    });
    return { error: null };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to submit request. Please try again.",
    };
  }
}
