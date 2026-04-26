import { prisma } from "../db";
import {
  invalidateCustomerCache,
  invalidateSaleCache,
} from "../cache";

// ─── Customer credit collection ─────────────────────────────
// Equivalent to the `process_customer_payment` Postgres RPC in the
// reference doc, implemented as a Prisma transaction so the logic
// stays in TypeScript (typed, testable) while still being atomic.
//
// One row per applied invoice is written to `payment_logs` — the
// audit trail for credit collections only. Cash / COD / online sales
// don't write here; their payment record IS the `amountPaid` column
// on the Sale row.
//
// Rules (mirror the reference spec exactly):
//   • Positive amount  = customer pays you. FIFO oldest-due first.
//   • Negative amount  = reversal/refund. LIFO most-recently-paid first.
//   • Round every step to 2 decimals (avoid 0.1+0.2 drift).
//   • inventoryRestored sales (cancelled/returned/lost) are excluded.
//   • Both `amountPaid/Due` and `reviewAmountPaid/Due` are mirrored
//     so audit reads via COALESCE see the live numbers.

const round = (v: number) => Math.round(v * 100) / 100;
const hasNonZero = (v: number) => Math.abs(round(v)) > 0;

type DueInvoiceRow = {
  id: string;
  invoiceNumber: string;
  amountPaid: number;
  amountDue: number;
  paymentTerms: string;
  paymentMethod: string;
  courierStatus: string | null;
  createdAt: Date;
  splits: { method: string; amount: number }[];
};

const isCreditEligible = (row: {
  paymentTerms: string;
  paymentMethod: string;
  courierStatus: string | null;
  splits: { method: string; amount: number }[];
}) => {
  const courier = (row.courierStatus ?? "").toLowerCase();
  if (["cancelled", "returned", "lost"].includes(courier)) return false;
  const terms = (row.paymentTerms ?? "").toLowerCase();
  const method = (row.paymentMethod ?? "").toLowerCase();
  const splitCredit = row.splits.some(
    (s) => (s.method ?? "").toLowerCase() === "credit" && Number(s.amount) > 0
  );
  return terms === "credit" || method === "credit" || splitCredit;
};

// ─── Reads ──────────────────────────────────────────────────

export async function getCustomerDueInvoices(
  tenantId: string,
  customerId: string
): Promise<DueInvoiceRow[]> {
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      customerId,
      isDeleted: false,
    },
    select: {
      id: true,
      invoiceNumber: true,
      amountPaid: true,
      amountDue: true,
      reviewAmountPaid: true,
      reviewAmountDue: true,
      paymentTerms: true,
      paymentMethod: true,
      courierStatus: true,
      createdAt: true,
      payments: { select: { method: true, amount: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return sales
    .map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      // Mirror semantics: the live number is COALESCE(review, original).
      amountPaid: Number(s.reviewAmountPaid ?? s.amountPaid),
      amountDue: Number(s.reviewAmountDue ?? s.amountDue),
      paymentTerms: s.paymentTerms,
      paymentMethod: s.paymentMethod,
      courierStatus: s.courierStatus,
      createdAt: s.createdAt,
      splits: s.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
    }))
    .filter(isCreditEligible)
    .filter((row) => row.amountDue > 0 || row.amountPaid > 0);
}

export async function getCustomerPaymentHistory(
  tenantId: string,
  customerId: string
) {
  const rows = await prisma.paymentLog.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    invoiceNumber: r.invoiceNumber,
    amount: Number(r.amount),
    paidByName: r.paidByName,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getOverdueCreditSales(tenantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      isDeleted: false,
      paymentTerms: "credit",
      amountDue: { gt: 0 },
      dueDate: { lt: today },
      courierStatus: { notIn: ["cancelled", "returned", "lost"] },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      grandTotal: true,
      amountPaid: true,
      amountDue: true,
      reviewAmountPaid: true,
      reviewAmountDue: true,
      dueDate: true,
      createdAt: true,
    },
    take: 500,
  });
  return sales.map((s) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    customerId: s.customerId,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    grandTotal: Number(s.grandTotal),
    amountPaid: Number(s.reviewAmountPaid ?? s.amountPaid),
    amountDue: Number(s.reviewAmountDue ?? s.amountDue),
    dueDate: s.dueDate?.toISOString() ?? null,
    daysOverdue: s.dueDate
      ? Math.floor(
          (today.getTime() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0,
    createdAt: s.createdAt.toISOString(),
  }));
}

// ─── Write — record customer payment ────────────────────────

export type RecordCustomerPaymentInput = {
  customerId: string;
  /** Signed: positive = pay, negative = reverse. */
  amount: number;
  paidByName: string;
  paidByUserId?: string | null;
};

export type AppliedInvoice = {
  paymentLogId: string;
  saleId: string;
  invoiceNumber: string;
  appliedAmount: number;
  updatedAmountPaid: number;
  updatedAmountDue: number;
  createdAt: string;
};

export async function recordCustomerPayment(
  tenantId: string,
  input: RecordCustomerPaymentInput
): Promise<AppliedInvoice[]> {
  const amount = round(input.amount);
  if (!hasNonZero(amount)) {
    throw new Error("Enter a non-zero amount before submitting.");
  }

  // Re-fetch invoices INSIDE the transaction (don't trust client cache).
  const result = await prisma.$transaction(async (tx) => {
    const sales = await tx.sale.findMany({
      where: { tenantId, customerId: input.customerId, isDeleted: false },
      select: {
        id: true,
        invoiceNumber: true,
        amountPaid: true,
        amountDue: true,
        reviewAmountPaid: true,
        reviewAmountDue: true,
        paymentTerms: true,
        paymentMethod: true,
        courierStatus: true,
        createdAt: true,
        payments: { select: { method: true, amount: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const eligible = sales
      .map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        amountPaid: Number(s.reviewAmountPaid ?? s.amountPaid),
        amountDue: Number(s.reviewAmountDue ?? s.amountDue),
        paymentTerms: s.paymentTerms,
        paymentMethod: s.paymentMethod,
        courierStatus: s.courierStatus,
        createdAt: s.createdAt,
        splits: s.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
        })),
      }))
      .filter(isCreditEligible);

    if (eligible.length === 0) {
      throw new Error("No payable credit invoices found for this customer.");
    }

    const totalDue = round(eligible.reduce((s, e) => s + e.amountDue, 0));
    const totalReversiblePaid = round(
      eligible.reduce((s, e) => s + e.amountPaid, 0)
    );

    if (amount > 0 && totalDue <= 0) {
      throw new Error("No due credit invoices found for this customer.");
    }
    if (amount > totalDue) {
      throw new Error("Payment amount exceeds the total due credit balance.");
    }
    if (amount < 0 && Math.abs(amount) > totalReversiblePaid) {
      throw new Error(
        "Adjustment amount exceeds the reversible paid amount."
      );
    }

    // Walk in the right order. Positive: oldest first. Negative:
    // most-recently-paid first → reverse the array.
    const ordered = amount > 0 ? eligible : [...eligible].reverse();
    const applied: AppliedInvoice[] = [];
    let remaining = amount;

    for (const inv of ordered) {
      if (!hasNonZero(remaining)) break;

      const cap = amount >= 0 ? inv.amountDue : inv.amountPaid;
      const signed =
        amount >= 0
          ? round(Math.min(remaining, cap))
          : round(-Math.min(Math.abs(remaining), cap));

      if (!hasNonZero(signed)) continue;

      const updatedPaid = round(inv.amountPaid + signed);
      const updatedDue = round(inv.amountDue - signed);
      const nextStatus =
        updatedDue <= 0 ? "paid" : updatedPaid <= 0 ? "pending" : "partial";

      await tx.sale.update({
        where: { id: inv.id },
        data: {
          amountPaid: updatedPaid,
          amountDue: updatedDue,
          // Mirror — see customer module guide §6 pitfall: audits use
          // COALESCE(review, original), so keep them in lock-step.
          reviewAmountPaid: updatedPaid,
          reviewAmountDue: updatedDue,
          paymentStatus: nextStatus,
        },
      });

      const log = await tx.paymentLog.create({
        data: {
          tenantId,
          saleId: inv.id,
          customerId: input.customerId,
          invoiceNumber: inv.invoiceNumber,
          amount: signed,
          paidByUserId: input.paidByUserId ?? null,
          paidByName: input.paidByName,
        },
      });

      applied.push({
        paymentLogId: log.id,
        saleId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        appliedAmount: signed,
        updatedAmountPaid: updatedPaid,
        updatedAmountDue: updatedDue,
        createdAt: log.createdAt.toISOString(),
      });

      remaining = round(remaining - signed);
    }

    if (applied.length === 0) {
      throw new Error(
        amount >= 0
          ? "No due credit invoices found for this customer."
          : "No paid credit invoices available for adjustment."
      );
    }

    return applied;
  });

  await invalidateSaleCache(tenantId);
  await invalidateCustomerCache(tenantId);

  return result;
}
