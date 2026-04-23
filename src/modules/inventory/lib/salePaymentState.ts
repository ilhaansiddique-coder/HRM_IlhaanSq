export type SalePaymentLifecycleStatus = "pending" | "partial" | "paid";

export interface SalePaymentSplitSnapshot {
  method?: string | null;
  amount?: number | string | null;
}

export interface SalePaymentStateSnapshot {
  payment_status?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  fee?: number | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  sale_payments?: SalePaymentSplitSnapshot[] | null;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeSalePaymentMethodKey = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "condition" ? "cod" : normalized;
};

export const getSalePaymentSplitTotals = (sale: SalePaymentStateSnapshot) => {
  const splits = (sale.sale_payments || []).map((split) => ({
    method: normalizeSalePaymentMethodKey(split.method),
    amount: Math.max(0, toNumber(split.amount)),
  }));

  return splits.reduce(
    (totals, split) => {
      if (split.method === "credit") {
        totals.credit += split.amount;
      } else if (split.method === "cod") {
        totals.cod += split.amount;
      } else if (split.method) {
        totals.paid += split.amount;
      }
      return totals;
    },
    { paid: 0, cod: 0, credit: 0 },
  );
};

export const isCreditSaleRecord = (sale: SalePaymentStateSnapshot) => {
  const paymentTerms = String(sale.payment_terms || "").toLowerCase();
  const paymentMethod = normalizeSalePaymentMethodKey(sale.payment_method);
  const splitTotals = getSalePaymentSplitTotals(sale);
  return paymentTerms === "credit" || paymentMethod === "credit" || splitTotals.credit > 0;
};

export const derivePaymentStatusFromAmounts = (
  amountPaid: number | null | undefined,
  amountDue: number | null | undefined,
): SalePaymentLifecycleStatus => {
  const safePaid = Math.max(0, toNumber(amountPaid));
  const safeDue = Math.max(0, toNumber(amountDue));

  if (safeDue <= 0) return "paid";
  if (safePaid > 0) return "partial";
  return "pending";
};

export const getDeliveredPaymentUpdate = (sale: SalePaymentStateSnapshot) => {
  const currentDue = Math.max(0, toNumber(sale.amount_due));
  const previousPaid = Math.max(0, toNumber(sale.amount_paid));
  const fee = Math.max(0, toNumber(sale.fee));
  const splitTotals = getSalePaymentSplitTotals(sale);
  const isCreditSale = isCreditSaleRecord(sale);

  const creditOutstanding =
    splitTotals.credit > 0
      ? splitTotals.credit
      : isCreditSale
        ? currentDue
        : 0;

  const codCollectible = Math.max(0, currentDue - creditOutstanding - fee);
  const amountPaid = Math.max(0, previousPaid + codCollectible);
  const amountDue = isCreditSale
    ? Math.max(0, currentDue - codCollectible)
    : 0;

  return {
    payment_status: derivePaymentStatusFromAmounts(amountPaid, amountDue),
    amount_paid: amountPaid,
    amount_due: amountDue,
    credit_outstanding: creditOutstanding,
    cod_collectible: codCollectible,
    is_credit_sale: isCreditSale,
  };
};
