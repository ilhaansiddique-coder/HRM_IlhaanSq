"use server";

import { requireTenant } from "@/lib/auth";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerHistory,
  type CustomerStatus,
} from "@/lib/services/customer.service";
import {
  getCustomerDueInvoices,
  getCustomerPaymentHistory,
  recordCustomerPayment,
} from "@/lib/services/customer-payment.service";
import { prisma } from "@/lib/db";
import { createApprovalRequest } from "@/lib/services/approvals.service";
import { revalidatePath } from "next/cache";

function parseInput(formData: FormData) {
  // Status comes from a Select; normalize anything outside the
  // allowed enum back to undefined so we don't violate the DB
  // CHECK constraint.
  const rawStatus = formData.get("status") as string | null;
  const status: CustomerStatus | undefined =
    rawStatus === "active" || rawStatus === "neutral" || rawStatus === "inactive"
      ? (rawStatus as CustomerStatus)
      : undefined;

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
    status,
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

// ─── Credit collection ──────────────────────────────────────
// All three actions are scoped to the current session's tenant via
// requireTenant — the underlying services double-check the customer
// belongs to the tenant via the `where: { tenantId, customerId }`
// filter, so cross-tenant reads/writes are impossible.

export async function getCustomerHistoryAction(customerId: string) {
  const session = await requireTenant();
  return getCustomerHistory(session.tenantId, customerId);
}

export async function getCustomerDueInvoicesAction(customerId: string) {
  const session = await requireTenant();
  const rows = await getCustomerDueInvoices(session.tenantId, customerId);
  // Plain primitives only — Decimals + Date go over the wire.
  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    amountPaid: r.amountPaid,
    amountDue: r.amountDue,
    paymentTerms: r.paymentTerms,
    paymentMethod: r.paymentMethod,
    courierStatus: r.courierStatus,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getCustomerPaymentHistoryAction(customerId: string) {
  const session = await requireTenant();
  return getCustomerPaymentHistory(session.tenantId, customerId);
}

export async function recordCustomerPaymentAction(formData: FormData) {
  const session = await requireTenant();

  const customerId = formData.get("customerId") as string;
  const rawAmount = formData.get("amount") as string;
  if (!customerId) throw new Error("Missing customerId");
  if (!rawAmount) throw new Error("Missing amount");

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("Enter a non-zero amount.");
  }

  // Display name for the audit log. Fall back chain: profile.fullName →
  // session.email → "Unknown User".
  const profile = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, email: true },
  });
  const paidByName =
    profile?.fullName ||
    profile?.email?.split("@")[0] ||
    "Unknown User";

  // Gated: deferred. The payment is NOT applied to invoices until approved
  // in /admin. The payload is what the approval handler runs on approval.
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: session.tenantId },
    select: { name: true },
  });
  await createApprovalRequest({
    tenantId: session.tenantId,
    type: "customer_payment",
    entityType: "Customer",
    entityId: customerId,
    title: customer?.name ?? "Customer payment",
    subtitle: `Payment ${amount.toLocaleString()}`,
    requestedBy: session.userId,
    requestedByName: paidByName,
    payload: { customerId, amount, paidByName, paidByUserId: session.userId },
  });

  revalidatePath("/customers");
  revalidatePath("/sales");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/admin");

  // Nothing applied yet — awaiting approval.
  return [] as Awaited<ReturnType<typeof recordCustomerPayment>>;
}
