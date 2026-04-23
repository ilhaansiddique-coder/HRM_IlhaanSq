import { supabase } from "@/integrations/supabase/client";

export interface PersistedSaleStatusSnapshot {
  id: string;
  courier_status?: string | null;
  payment_status?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
}

interface PersistSaleStatusUpdateArgs {
  saleId: string;
  update: Record<string, unknown>;
}

const SALE_STATUS_SELECT = "id, courier_status, payment_status, amount_paid, amount_due";
const VERIFIABLE_STATUS_FIELDS = [
  "courier_status",
  "payment_status",
  "amount_paid",
  "amount_due",
] as const;

const createSilentRlsFailure = () =>
  new Error("Sale status update was not persisted. Check tenant permissions/RLS for sales updates.");

const valuesMatch = (expected: unknown, actual: unknown): boolean => {
  if (expected === null || actual === null) {
    return expected === actual;
  }

  if (typeof expected === "number" || typeof actual === "number") {
    return Math.abs(Number(expected ?? 0) - Number(actual ?? 0)) <= 0.0001;
  }

  return String(expected ?? "") === String(actual ?? "");
};

const snapshotMatchesUpdate = (
  snapshot: PersistedSaleStatusSnapshot,
  update: Record<string, unknown>,
): boolean => {
  for (const field of VERIFIABLE_STATUS_FIELDS) {
    if (!(field in update)) {
      continue;
    }

    if (!valuesMatch(update[field], snapshot[field])) {
      return false;
    }
  }

  return true;
};

export const persistSaleStatusUpdate = async ({
  saleId,
  update,
}: PersistSaleStatusUpdateArgs): Promise<PersistedSaleStatusSnapshot> => {
  const { error: updateError } = await supabase
    .from("sales")
    .update(update)
    .eq("id", saleId);

  if (updateError) {
    throw updateError;
  }

  const { data, error: readError } = await supabase
    .from("sales")
    .select(SALE_STATUS_SELECT)
    .eq("id", saleId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!data || !snapshotMatchesUpdate(data as PersistedSaleStatusSnapshot, update)) {
    throw createSilentRlsFailure();
  }

  return data as PersistedSaleStatusSnapshot;
};
