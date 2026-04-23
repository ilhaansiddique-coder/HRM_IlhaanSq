import {
  derivePaymentStatusFromAmounts,
  getDeliveredPaymentUpdate,
  isCreditSaleRecord,
  type SalePaymentStateSnapshot,
} from "@/lib/salePaymentState";

export type CourierStatus =
  | "not_sent"
  | "pending"
  | "in_review"
  | "sent"
  | "in_transit"
  | "delivery_ready"
  | "out_for_delivery"
  | "delivered"
  | "payout_ready"
  | "cancelled"
  | "returned"
  | "lost";

export type PaymentStatus = "paid" | "partial" | "pending" | "cancelled";
export type PaymentTerms = "cod" | "credit" | "prepaid" | "mixed" | "immediate";
export type StockAction = "deduct" | "restore" | "none";

export interface BalanceSplit {
  creditDue: number;
  normalDue: number;
  totalDue: number;
}

export interface SaleLike extends SalePaymentStateSnapshot {
  id?: string | null;
  grand_total?: number | null;
  courier_status?: string | null;
  order_status?: string | null;
}

export interface PaymentStateSnapshot {
  payment_status?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
}

export interface SaleStatusRuleSnapshot extends SaleLike, PaymentStateSnapshot {
  status_backup_payment_status?: string | null;
  status_backup_amount_paid?: number | null;
  status_backup_amount_due?: number | null;
}

export interface SaleUpdate {
  courier_status: CourierStatus;
  order_status: CourierStatus;
  payment_status: PaymentStatus;
  amount_paid: number;
  amount_due: number;
  stock_action: StockAction;
  use_backup: boolean;
}

export interface SaleStatusUpdatePlan {
  displayStatus: CourierStatus;
  previousStatus: string;
  previousPayment: PaymentStateSnapshot;
  paymentUpdate: Record<string, unknown>;
  update: Record<string, unknown>;
  hasStatusChanged: boolean;
  hasPaymentChanged: boolean;
  shouldStoreLocalBackup: boolean;
  shouldClearLocalBackup: boolean;
  localBackupToStore: PaymentStateSnapshot | null;
  isDeliveredLike: boolean;
}

const CANCELLED_STATUSES: CourierStatus[] = ["cancelled", "returned", "lost"];
const RESTORE_STATUSES: CourierStatus[] = ["cancelled", "returned"];
const STATUS_BACKUP_FIELD_MAP = {
  status_backup_payment_status: "payment_status",
  status_backup_amount_paid: "amount_paid",
  status_backup_amount_due: "amount_due",
} as const;

export const SALE_STATUS_RULE_SNAPSHOT_SELECT = [
  "payment_status",
  "amount_paid",
  "amount_due",
  "fee",
  "payment_terms",
  "payment_method",
  "courier_status",
  "order_status",
  "sale_payments!sale_payments_sale_id_fkey(method, amount)",
  "status_backup_payment_status",
  "status_backup_amount_paid",
  "status_backup_amount_due",
].join(", ");

export const LEGACY_SALE_STATUS_RULE_SNAPSHOT_SELECT = [
  "payment_status",
  "amount_paid",
  "amount_due",
  "fee",
  "payment_method",
  "courier_status",
  "order_status",
  "sale_payments!sale_payments_sale_id_fkey(method, amount)",
  "status_backup_payment_status",
  "status_backup_amount_paid",
  "status_backup_amount_due",
].join(", ");

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePaymentStatus = (value?: string | null): PaymentStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "partial") return "partial";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
};

export const normalizeCourierStatus = (value?: string | null): CourierStatus => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized || normalized === "unknown") return "not_sent";
  if (normalized.includes("pickup_cancelled") || normalized.includes("pickup_cancel")) return "cancelled";
  if (normalized.includes("cancelled") || normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("returned") || normalized.includes("return")) return "returned";
  if (normalized.includes("lost")) return "lost";
  if (normalized.includes("ready_for_delivery") || normalized === "delivery_ready") return "delivery_ready";
  if (normalized.includes("out_for_delivery")) return "out_for_delivery";
  if (normalized.includes("in_transit") || normalized.includes("picked_up")) return "in_transit";
  if (normalized.includes("delivered") || normalized.includes("completed")) return "delivered";
  if (normalized.includes("payout_ready")) return "payout_ready";
  if (normalized === "in_review") return "in_review";
  if (normalized === "sent") return "sent";
  if (normalized === "pending") return "pending";
  if (normalized === "not_sent") return "not_sent";
  return "not_sent";
};

const valuesMatch = (expected: unknown, actual: unknown): boolean => {
  if (expected === null || actual === null) {
    return expected === actual;
  }

  if (typeof expected === "number" || typeof actual === "number") {
    return Math.abs(toNumber(expected) - toNumber(actual)) <= 0.0001;
  }

  return String(expected ?? "") === String(actual ?? "");
};

export const resolveCourierStatusForSync = (
  rawStatus?: string | null,
  currentStatus?: string | null,
): CourierStatus => {
  const normalizedCurrentStatus = String(currentStatus || "").trim().toLowerCase();
  const normalizedIncomingStatus = normalizeCourierStatus(rawStatus);

  if (normalizedCurrentStatus === "delivered") {
    return "delivered";
  }

  if (
    normalizedCurrentStatus &&
    normalizedCurrentStatus === normalizedIncomingStatus
  ) {
    return normalizedCurrentStatus as CourierStatus;
  }

  const userSetNotSentOrSent = ["not_sent", "sent"].includes(normalizedCurrentStatus);
  const userSetCancelledType = CANCELLED_STATUSES.includes(
    normalizedCurrentStatus as CourierStatus,
  );

  if (normalizedIncomingStatus === "not_sent" || normalizedIncomingStatus === "in_review") {
    return userSetNotSentOrSent
      ? (normalizedCurrentStatus as CourierStatus)
      : "not_sent";
  }

  if (normalizedIncomingStatus === "pending") {
    return normalizedCurrentStatus === "sent" ? "sent" : "sent";
  }

  if (normalizedIncomingStatus === "cancelled") {
    return userSetCancelledType
      ? (normalizedCurrentStatus as CourierStatus)
      : "cancelled";
  }

  if (normalizedIncomingStatus === "returned") {
    return userSetCancelledType
      ? (normalizedCurrentStatus as CourierStatus)
      : "returned";
  }

  return normalizedIncomingStatus;
};

export const getSaleNetAmount = (sale: Pick<SaleLike, "grand_total" | "fee">) =>
  Math.max(0, toNumber(sale.grand_total) - toNumber(sale.fee));

export const getSaleNetPaid = (sale: Pick<SaleLike, "amount_paid" | "fee">) =>
  Math.max(0, toNumber(sale.amount_paid) - toNumber(sale.fee));

const isCancelledType = (status: CourierStatus) => CANCELLED_STATUSES.includes(status);

export const isSaleValidForRevenue = (sale: Pick<SaleLike, "payment_status" | "courier_status">) => {
  if (normalizePaymentStatus(sale.payment_status) === "cancelled") {
    return false;
  }
  return !isCancelledType(normalizeCourierStatus(sale.courier_status));
};

export const isSaleCountableInUnitsSold = (
  sale: Pick<SaleLike, "payment_status" | "courier_status">,
) => isSaleValidForRevenue(sale);

export const isSaleExcludedFromCustomerDue = (
  sale: Pick<SaleLike, "payment_status" | "courier_status">,
) => !isSaleValidForRevenue(sale);

export const getSaleRevenueContribution = (
  sale: Pick<SaleLike, "grand_total" | "amount_paid" | "fee" | "payment_status" | "courier_status">,
) => {
  if (!isSaleValidForRevenue(sale)) {
    return 0;
  }

  if (normalizePaymentStatus(sale.payment_status) === "partial") {
    return getSaleNetPaid(sale);
  }

  return getSaleNetAmount(sale);
};

export const calculateSaleOutstandingBalance = (
  sale: Pick<SaleLike, "grand_total" | "amount_paid" | "fee" | "payment_status" | "courier_status" | "payment_terms">,
): BalanceSplit => {
  if (isSaleExcludedFromCustomerDue(sale)) {
    return { creditDue: 0, normalDue: 0, totalDue: 0 };
  }

  const outstanding = Math.max(0, getSaleNetAmount(sale) - getSaleNetPaid(sale));
  if (outstanding <= 0) {
    return { creditDue: 0, normalDue: 0, totalDue: 0 };
  }

  const paymentTerms = String(sale.payment_terms || "").trim().toLowerCase();
  if (paymentTerms === "credit") {
    return { creditDue: outstanding, normalDue: 0, totalDue: outstanding };
  }

  return { creditDue: 0, normalDue: outstanding, totalDue: outstanding };
};

export const calculateCustomerOutstandingBalance = (
  _customer: unknown,
  sales: Array<
    Pick<SaleLike, "grand_total" | "amount_paid" | "fee" | "payment_status" | "courier_status" | "payment_terms">
  >,
): BalanceSplit => {
  return sales.reduce<BalanceSplit>(
    (totals, sale) => {
      const contribution = calculateSaleOutstandingBalance(sale);
      totals.creditDue += contribution.creditDue;
      totals.normalDue += contribution.normalDue;
      totals.totalDue += contribution.totalDue;
      return totals;
    },
    { creditDue: 0, normalDue: 0, totalDue: 0 },
  );
};

export const shouldRestoreInventory = (oldStatus?: string | null, newStatus?: string | null) => {
  const previous = normalizeCourierStatus(oldStatus);
  const next = normalizeCourierStatus(newStatus);
  return !CANCELLED_STATUSES.includes(previous) && RESTORE_STATUSES.includes(next);
};

export const shouldDeductInventory = (oldStatus?: string | null, newStatus?: string | null) => {
  const previous = normalizeCourierStatus(oldStatus);
  const next = normalizeCourierStatus(newStatus);
  return RESTORE_STATUSES.includes(previous) && !CANCELLED_STATUSES.includes(next);
};

export const applyCourierStatusBusinessRule = (
  sale: Pick<
    SaleLike,
    "amount_paid" | "amount_due" | "fee" | "payment_method" | "payment_status" | "payment_terms" | "courier_status" | "sale_payments"
  >,
  newStatus?: string | null,
): SaleUpdate => {
  const normalizedStatus = normalizeCourierStatus(newStatus);
  const stockAction = shouldRestoreInventory(sale.courier_status, normalizedStatus)
    ? "restore"
    : shouldDeductInventory(sale.courier_status, normalizedStatus)
      ? "deduct"
      : "none";

  if (normalizedStatus === "cancelled" || normalizedStatus === "returned") {
    return {
      courier_status: normalizedStatus,
      order_status: normalizedStatus,
      payment_status: "cancelled",
      amount_paid: 0,
      amount_due: 0,
      stock_action: stockAction,
      use_backup: false,
    };
  }

  if (normalizedStatus === "lost") {
    return {
      courier_status: "lost",
      order_status: "lost",
      payment_status: "cancelled",
      amount_paid: 0,
      amount_due: 0,
      stock_action: "none",
      use_backup: false,
    };
  }

  if (normalizedStatus === "delivered" || normalizedStatus === "payout_ready") {
    const deliveredPayment = getDeliveredPaymentUpdate(sale);
    return {
      courier_status: normalizedStatus,
      order_status: normalizedStatus,
      payment_status: normalizePaymentStatus(deliveredPayment.payment_status),
      amount_paid: Math.max(0, toNumber(deliveredPayment.amount_paid)),
      amount_due: Math.max(0, toNumber(deliveredPayment.amount_due)),
      stock_action: stockAction,
      use_backup: true,
    };
  }

  const currentAmountPaid = Math.max(0, toNumber(sale.amount_paid));
  const currentAmountDue = Math.max(0, toNumber(sale.amount_due));
  const fallbackPaymentStatus = isCreditSaleRecord(sale)
    ? normalizePaymentStatus(sale.payment_status)
    : derivePaymentStatusFromAmounts(currentAmountPaid, currentAmountDue);

  return {
    courier_status: normalizedStatus,
    order_status: normalizedStatus,
    payment_status: fallbackPaymentStatus,
    amount_paid: currentAmountPaid,
    amount_due: currentAmountDue,
    stock_action: stockAction,
    use_backup: true,
  };
};

export const buildSaleStatusUpdatePlan = ({
  snapshot,
  rawStatus,
  lastStatusCheck,
  consignmentId,
  localBackup,
}: {
  snapshot: SaleStatusRuleSnapshot;
  rawStatus?: string | null;
  lastStatusCheck?: string;
  consignmentId?: string | null;
  localBackup?: PaymentStateSnapshot | null;
}): SaleStatusUpdatePlan => {
  const previousStatus = String(snapshot.courier_status || snapshot.order_status || "").trim().toLowerCase() || "not_sent";
  const displayStatus = resolveCourierStatusForSync(rawStatus, previousStatus);
  const previousPayment: PaymentStateSnapshot = {
    payment_status: snapshot.payment_status ?? null,
    amount_paid: snapshot.amount_paid ?? null,
    amount_due: snapshot.amount_due ?? null,
  };
  const statusBackup: PaymentStateSnapshot = {
    payment_status: snapshot.status_backup_payment_status ?? null,
    amount_paid: snapshot.status_backup_amount_paid ?? null,
    amount_due: snapshot.status_backup_amount_due ?? null,
  };
  const hasStatusBackup =
    statusBackup.payment_status !== null ||
    statusBackup.amount_paid !== null ||
    statusBackup.amount_due !== null;
  const isDeliveredLike = displayStatus === "delivered" || displayStatus === "payout_ready";

  let paymentUpdate: Record<string, unknown> = {};
  let shouldStoreLocalBackup = false;
  let shouldClearLocalBackup = false;
  let localBackupToStore: PaymentStateSnapshot | null = null;

  if (isDeliveredLike) {
    const deliveredPayment = getDeliveredPaymentUpdate(snapshot);
    paymentUpdate = {
      payment_status: normalizePaymentStatus(deliveredPayment.payment_status),
      amount_paid: Math.max(0, toNumber(deliveredPayment.amount_paid)),
      amount_due: Math.max(0, toNumber(deliveredPayment.amount_due)),
    };

    if (!hasStatusBackup) {
      paymentUpdate.status_backup_payment_status = previousPayment.payment_status;
      paymentUpdate.status_backup_amount_paid = previousPayment.amount_paid ?? 0;
      paymentUpdate.status_backup_amount_due = previousPayment.amount_due ?? 0;
      shouldStoreLocalBackup = true;
      localBackupToStore = previousPayment;
    }
  } else if (displayStatus === "cancelled" || displayStatus === "returned" || displayStatus === "lost") {
    paymentUpdate = {
      payment_status: "cancelled",
      amount_paid: 0,
      amount_due: 0,
    };
    shouldClearLocalBackup = true;
  } else if (hasStatusBackup) {
    paymentUpdate = {
      payment_status: statusBackup.payment_status,
      amount_paid: statusBackup.amount_paid,
      amount_due: statusBackup.amount_due,
      status_backup_payment_status: null,
      status_backup_amount_paid: null,
      status_backup_amount_due: null,
    };
    shouldClearLocalBackup = true;
  } else if (localBackup) {
    paymentUpdate = {
      payment_status: localBackup.payment_status ?? "pending",
      amount_paid: localBackup.amount_paid ?? 0,
      amount_due: localBackup.amount_due ?? 0,
    };
    shouldClearLocalBackup = true;
  } else {
    paymentUpdate = { payment_status: "pending" };
    shouldClearLocalBackup = true;
  }

  const hasStatusChanged = displayStatus !== previousStatus;
  const hasPaymentChanged = Object.entries(paymentUpdate).some(([field, nextValue]) => {
    if (field in STATUS_BACKUP_FIELD_MAP) {
      const backupField =
        STATUS_BACKUP_FIELD_MAP[field as keyof typeof STATUS_BACKUP_FIELD_MAP];
      return !valuesMatch(nextValue, statusBackup[backupField]);
    }

    return !valuesMatch(nextValue, previousPayment[field as keyof PaymentStateSnapshot]);
  });

  const update: Record<string, unknown> = {
    last_status_check: lastStatusCheck ?? new Date().toISOString(),
  };

  if (consignmentId) {
    update.cn_number = consignmentId;
    update.consignment_id = consignmentId;
  }

  if (hasStatusChanged || hasPaymentChanged) {
    update.courier_status = displayStatus;
    update.order_status = displayStatus;
    Object.assign(update, paymentUpdate);
  }

  return {
    displayStatus,
    previousStatus,
    previousPayment,
    paymentUpdate,
    update,
    hasStatusChanged,
    hasPaymentChanged,
    shouldStoreLocalBackup,
    shouldClearLocalBackup,
    localBackupToStore,
    isDeliveredLike,
  };
};
