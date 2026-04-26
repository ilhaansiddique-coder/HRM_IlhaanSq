// Pure helpers for the customer-payment dialog. No DB, no React. The
// same algorithm runs both client-side (live preview while the cashier
// types) and server-side (via lib/services/customer-payment.service.ts
// when the form is submitted). Keeping the math here means the preview
// numbers always match what the server will write.

export type DueInvoice = {
  id: string;
  invoiceNumber: string;
  amountPaid: number;
  amountDue: number;
  createdAt: string;
};

export type DistributedRow = DueInvoice & {
  /** Signed: + applied, − reversed, 0 untouched. */
  allocatedAmount: number;
  /** What the invoice's `amount_paid` would be after the hypothetical adjustment. */
  updatedPaidAmount: number;
  /** What the invoice's `amount_due` would be after the hypothetical adjustment. */
  currentDueBalance: number;
};

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Distribute a signed pay-now amount across the invoices.
 *
 * - Positive total: pour into oldest-due-first (FIFO). Caps at each
 *   invoice's `amountDue` so we never apply more than the row owes.
 * - Negative total: reverse from most-recently-paid-first (LIFO).
 *   Caps at each invoice's `amountPaid` so we never reverse more
 *   than was paid.
 *
 * `invoices` MUST be sorted oldest-first (created_at ASC). The caller
 * (the dialog hook + the server fetcher) both guarantee that.
 */
export function distributePaymentAmount(
  invoices: DueInvoice[],
  totalPayNow: number
): DistributedRow[] {
  const rows: DistributedRow[] = invoices.map((inv) => ({
    ...inv,
    allocatedAmount: 0,
    updatedPaidAmount: inv.amountPaid,
    currentDueBalance: inv.amountDue,
  }));

  if (totalPayNow === 0) return rows;

  if (totalPayNow > 0) {
    // FIFO — oldest first.
    let remaining = totalPayNow;
    return rows.map((inv) => {
      const allocated = round(Math.min(remaining, inv.amountDue));
      remaining = round(Math.max(0, remaining - allocated));
      return {
        ...inv,
        allocatedAmount: allocated,
        updatedPaidAmount: round(Math.max(0, inv.amountPaid + allocated)),
        currentDueBalance: round(Math.max(0, inv.amountDue - allocated)),
      };
    });
  }

  // LIFO — most recently paid first. Walk from the end.
  let remainingAdjustment = round(Math.abs(totalPayNow));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (remainingAdjustment <= 0) break;
    const inv = rows[i];
    const reversible = Math.max(0, inv.amountPaid);
    const allocated = round(Math.min(remainingAdjustment, reversible));
    if (allocated <= 0) continue;
    remainingAdjustment = round(Math.max(0, remainingAdjustment - allocated));
    rows[i] = {
      ...inv,
      allocatedAmount: -allocated,
      updatedPaidAmount: round(Math.max(0, inv.amountPaid - allocated)),
      currentDueBalance: round(Math.max(0, inv.amountDue + allocated)),
    };
  }
  return rows;
}

/**
 * Sanitize the input string so the user can only type valid signed
 * decimals: optional leading "-", digits, optional "." with at most
 * 2 decimal places. Allows the bare "-" intermediate state so the
 * cashier can type "-300" character by character.
 */
export function sanitizeAmountInput(value: string): string {
  const isNegative = value.trim().startsWith("-");
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...decimalParts] = cleaned.split(".");
  const normalized =
    decimalParts.length === 0
      ? cleaned
      : `${whole}.${decimalParts.join("").slice(0, 2)}`;
  if (!normalized) return isNegative ? "-" : "";
  return `${isNegative ? "-" : ""}${normalized}`;
}

/** Parse the sanitized input into a number, rounded to 2 decimals. */
export function parseAmount(rawValue: string): number {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === "-") return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? round(parsed) : 0;
}

/**
 * Returns an error string ("" if valid) for the cashier's pay-now
 * input. Three rules:
 *   1. Must be a real number.
 *   2. Positive amounts can't exceed total credit due.
 *   3. Negative amounts can't reverse more than was previously paid.
 */
export function validatePayNow(
  payNowValue: string,
  totalCreditDue: number,
  totalReversiblePaid: number
): string {
  const trimmed = payNowValue.trim();
  if (!trimmed || trimmed === "-") return "Enter a valid amount.";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return "Enter a valid amount.";
  if (parsed === 0) return "Amount cannot be zero.";
  if (parsed > totalCreditDue) {
    return "Amount cannot exceed the total credit due balance.";
  }
  if (parsed < 0 && Math.abs(parsed) > totalReversiblePaid) {
    return "Amount cannot exceed the reversible paid amount.";
  }
  return "";
}
