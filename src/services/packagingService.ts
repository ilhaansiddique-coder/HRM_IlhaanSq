import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type JsonRecord = Record<string, unknown>;

export interface PackagingQueueItem {
  sale_id: string;
  invoice_number: string;
  status: string | null;
  packaged: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  canonical_customer_name: string;
  alias_names: string[];
  seller_name: string | null;
}

export interface PackagingQueueResult {
  packagingSupported: boolean;
  readOnly: boolean;
  source: "rpc" | "fallback";
  items: PackagingQueueItem[];
  message?: string;
}

export interface PackagingHistoryItem {
  id: string;
  user_id: string | null;
  action: string;
  summary: string | null;
  details: JsonRecord | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

export interface PackagingMutationResult {
  sale_id: string;
  packaged: boolean;
  changed: boolean;
  idempotent: boolean;
  updated_at: string | null;
}

type PackagingQueueRpcPayload = {
  packaging_supported?: boolean;
  read_only?: boolean;
  items?: PackagingQueueItem[];
};

type PackagingHistoryRpcPayload = {
  sale_id?: string;
  items?: PackagingHistoryItem[];
};

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: PostgrestError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asStringOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

const asBooleanOrNull = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeQueueItem = (value: unknown): PackagingQueueItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const saleId = asStringOrNull(value.sale_id);
  const invoiceNumber = asStringOrNull(value.invoice_number);
  const canonicalCustomerName = asStringOrNull(value.canonical_customer_name);

  if (!saleId || !invoiceNumber || !canonicalCustomerName) {
    return null;
  }

  return {
    sale_id: saleId,
    invoice_number: invoiceNumber,
    status: asStringOrNull(value.status),
    packaged: asBooleanOrNull(value.packaged),
    created_at: asStringOrNull(value.created_at),
    updated_at: asStringOrNull(value.updated_at),
    created_by: asStringOrNull(value.created_by),
    canonical_customer_name: canonicalCustomerName,
    alias_names: asStringArray(value.alias_names),
    seller_name: asStringOrNull(value.seller_name),
  };
};

const normalizeHistoryItem = (value: unknown): PackagingHistoryItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = asStringOrNull(value.id);
  const action = asStringOrNull(value.action);
  const createdAt = asStringOrNull(value.created_at);

  if (!id || !action || !createdAt) {
    return null;
  }

  return {
    id,
    user_id: asStringOrNull(value.user_id),
    action,
    summary: asStringOrNull(value.summary),
    details: isRecord(value.details) ? value.details : null,
    created_at: createdAt,
    full_name: asStringOrNull(value.full_name),
    email: asStringOrNull(value.email),
  };
};

const normalizeMutationResult = (value: unknown): PackagingMutationResult => {
  if (!isRecord(value)) {
    throw new Error("Packaging action returned an invalid response.");
  }

  const saleId = asStringOrNull(value.sale_id);
  const packaged = asBooleanOrNull(value.packaged);
  const changed = asBooleanOrNull(value.changed);
  const idempotent = asBooleanOrNull(value.idempotent);

  if (!saleId || packaged === null || changed === null || idempotent === null) {
    throw new Error("Packaging action returned an incomplete response.");
  }

  return {
    sale_id: saleId,
    packaged,
    changed,
    idempotent,
    updated_at: asStringOrNull(value.updated_at),
  };
};

const isRpcMissingError = (error: unknown, functionName: string) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /could not find the function|does not exist|not found|pgrst202/i.test(message) &&
    message.toLowerCase().includes(functionName.toLowerCase());
};

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /column|schema cache|pgrst204|42703/i.test(message) &&
    message.toLowerCase().includes(columnName.toLowerCase());
};

const isPackableStatus = (status: string | null) => !/(cancelled|returned|lost)/i.test(status ?? "");

const getRowStatus = (row: Record<string, unknown>) =>
  asStringOrNull(row.courier_status) ?? asStringOrNull(row.status) ?? asStringOrNull(row.order_status);

const matchesSearch = (item: PackagingQueueItem, search: string | null) => {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  return (
    item.invoice_number.toLowerCase().includes(normalizedSearch) ||
    item.canonical_customer_name.toLowerCase().includes(normalizedSearch) ||
    item.alias_names.some((alias) => alias.toLowerCase().includes(normalizedSearch)) ||
    (item.seller_name ?? "").toLowerCase().includes(normalizedSearch)
  );
};

const sortQueueItems = (items: PackagingQueueItem[]) =>
  [...items].sort((left, right) => {
    const leftPackaged = left.packaged === true ? 1 : 0;
    const rightPackaged = right.packaged === true ? 1 : 0;
    if (leftPackaged !== rightPackaged) {
      return leftPackaged - rightPackaged;
    }

    const leftTime = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
    const rightTime = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
    return rightTime - leftTime;
  });

const fetchFallbackQueueItems = async (search: string | null): Promise<PackagingQueueResult> => {
  const baseSelect =
    "id, invoice_number, status, courier_status, order_status, created_at, updated_at, created_by, customer_id, customer_name, packaged";
  const fallbackSelect =
    "id, invoice_number, status, courier_status, order_status, created_at, updated_at, created_by, customer_id, customer_name";

  let salesRows: Array<Record<string, unknown>> = [];
  let packagedColumnAvailable = true;

  const packagedAttempt = await supabase
    .from("sales")
    .select(baseSelect)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });

  if (packagedAttempt.error && isMissingColumnError(packagedAttempt.error, "packaged")) {
    packagedColumnAvailable = false;
    const withoutPackaged = await supabase
      .from("sales")
      .select(fallbackSelect)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false });

    if (withoutPackaged.error) {
      throw withoutPackaged.error;
    }

    salesRows = (withoutPackaged.data ?? []) as Array<Record<string, unknown>>;
  } else {
    if (packagedAttempt.error) {
      throw packagedAttempt.error;
    }

    salesRows = (packagedAttempt.data ?? []) as Array<Record<string, unknown>>;
  }

  const packableRows = salesRows.filter((row) => isPackableStatus(getRowStatus(row)));
  const customerIds = packableRows
    .map((row) => asStringOrNull(row.customer_id))
    .filter((value): value is string => !!value);

  let customerRows: Array<Record<string, unknown>> = [];
  if (customerIds.length) {
    const withAliases = await supabase
      .from("customers")
      .select("id, name, alias_names")
      .in("id", customerIds)
      .eq("is_deleted", false);

    if (withAliases.error && isMissingColumnError(withAliases.error, "alias_names")) {
      const withoutAliases = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds)
        .eq("is_deleted", false);

      if (withoutAliases.error) {
        throw withoutAliases.error;
      }

      customerRows = (withoutAliases.data ?? []) as Array<Record<string, unknown>>;
    } else {
      if (withAliases.error) {
        throw withAliases.error;
      }

      customerRows = (withAliases.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  const { data: sellersData, error: sellersError } = await supabase.rpc("get_all_users_with_roles");

  const customerMap = new Map(
    customerRows.map((customer) => [
      asStringOrNull(customer.id),
      {
        name: asStringOrNull(customer.name),
        alias_names: asStringArray(customer.alias_names),
      },
    ]),
  );

  const sellerMap = new Map<string, string>();
  if (!sellersError && Array.isArray(sellersData)) {
    for (const seller of sellersData as Array<Record<string, unknown>>) {
      const sellerId = asStringOrNull(seller.id);
      if (!sellerId) {
        continue;
      }
      sellerMap.set(sellerId, asStringOrNull(seller.full_name) ?? "Unknown User");
    }
  }

  const items = sortQueueItems(
    packableRows
      .map<PackagingQueueItem | null>((row) => {
        const saleId = asStringOrNull(row.id);
        const invoiceNumber = asStringOrNull(row.invoice_number);
        if (!saleId || !invoiceNumber) {
          return null;
        }

        const customerId = asStringOrNull(row.customer_id);
        const customerRecord = customerId ? customerMap.get(customerId) : undefined;
        const sellerId = asStringOrNull(row.created_by);

        return {
          sale_id: saleId,
          invoice_number: invoiceNumber,
          status: getRowStatus(row),
          packaged: packagedColumnAvailable ? asBooleanOrNull(row.packaged) : null,
          created_at: asStringOrNull(row.created_at),
          updated_at: asStringOrNull(row.updated_at),
          created_by: sellerId,
          canonical_customer_name:
            customerRecord?.name ?? asStringOrNull(row.customer_name) ?? "Unknown Customer",
          alias_names: customerRecord?.alias_names ?? [],
          seller_name: sellerId ? sellerMap.get(sellerId) ?? "Unknown User" : "Unknown User",
        };
      })
      .filter((item): item is PackagingQueueItem => !!item)
      .filter((item) => matchesSearch(item, search)),
  );

  return {
    packagingSupported: packagedColumnAvailable,
    readOnly: true,
    source: "fallback",
    items,
    message: packagedColumnAvailable
      ? "Packaging actions are unavailable until the packaging RPCs are deployed."
      : "Packaging schema is not available yet. The queue is in read-only fallback mode.",
  };
};

export const getPackagingQueue = async (search: string): Promise<PackagingQueueResult> => {
  const normalizedSearch = search.trim() || null;

  const { data, error } = await rpcClient.rpc("get_packaging_queue", {
    p_search: normalizedSearch,
  });

  if (error) {
    if (isRpcMissingError(error, "get_packaging_queue")) {
      return fetchFallbackQueueItems(normalizedSearch);
    }

    throw error;
  }

  const payload = isRecord(data) ? (data as PackagingQueueRpcPayload) : null;
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeQueueItem).filter((item): item is PackagingQueueItem => !!item)
    : [];

  return {
    packagingSupported: payload?.packaging_supported !== false,
    readOnly: payload?.read_only === true,
    source: "rpc",
    items: sortQueueItems(items),
  };
};

export const getPackagingHistory = async (saleId: string): Promise<PackagingHistoryItem[]> => {
  const { data, error } = await rpcClient.rpc("get_packaging_history", {
    p_sale_id: saleId,
  });

  if (error) {
    if (isRpcMissingError(error, "get_packaging_history")) {
      const fallback = await supabase
        .from("activity_logs_view")
        .select("id, user_id, action, summary, details, created_at, full_name, email")
        .eq("entity_type", "sales")
        .eq("entity_id", saleId)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        throw fallback.error;
      }

      return ((fallback.data ?? []) as Array<Record<string, unknown>>)
        .map(normalizeHistoryItem)
        .filter((item): item is PackagingHistoryItem => !!item)
        .filter((item) => item.details?.context === "packaging");
    }

    throw error;
  }

  const payload = isRecord(data) ? (data as PackagingHistoryRpcPayload) : null;
  return Array.isArray(payload?.items)
    ? payload.items.map(normalizeHistoryItem).filter((item): item is PackagingHistoryItem => !!item)
    : [];
};

const setPackagingState = async (saleId: string, packaged: boolean): Promise<PackagingMutationResult> => {
  const { data, error } = await rpcClient.rpc("set_packaging_state", {
    p_sale_id: saleId,
    p_packaged: packaged,
  });

  if (error) {
    if (isRpcMissingError(error, "set_packaging_state")) {
      throw new Error("Packaging actions are unavailable until the packaging migration is deployed.");
    }

    throw error;
  }

  return normalizeMutationResult(data);
};

export const packSale = async (saleId: string) => setPackagingState(saleId, true);

export const unpackSale = async (saleId: string) => setPackagingState(saleId, false);
