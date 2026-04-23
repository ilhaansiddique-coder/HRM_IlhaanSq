import { supabase } from "@/integrations/supabase/client";
import { invokeProtectedApi } from "@/utils/invokeProtectedApi";

type LooseRow = Record<string, unknown>;

const SALES_SELECT = [
  "id",
  "invoice_number",
  "customer_id",
  "customer_name",
  "customer_phone",
  "customer_whatsapp",
  "customer_address",
  "courier_name",
  "courier_status",
  "payment_method",
  "payment_status",
  "payment_terms",
  "grand_total",
  "amount_paid",
  "amount_due",
  "review_amount_due",
  "fee",
  "created_at",
  "is_deleted",
].join(", ");

const ITEM_SELECT_VARIANTS = [
  "id, sale_id, product_id, product_name, product_image_url, variant_image_url, quantity, total",
  "id, sale_id, product_id, product_name, product_image_url, quantity, total",
  "id, sale_id, product_id, product_name, quantity, total",
];

const CUSTOMER_SELECT = "id, phone, whatsapp, address";
const PRODUCT_SELECT = "id, name, sku, stock_quantity, image_url";
const BATCH_SIZE = 100;
const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  "";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const isPrivateIpv4Address = (hostname: string) =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const shouldPreferDirectCaseStudyDataset = (rawApiUrl: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  if (!rawApiUrl) {
    return true;
  }

  try {
    const parsedUrl = new URL(rawApiUrl);
    return LOCAL_HOSTNAMES.has(parsedUrl.hostname.toLowerCase()) || isPrivateIpv4Address(parsedUrl.hostname);
  } catch {
    return false;
  }
};

export type CaseStudyReportSale = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  customer_address: string | null;
  courier_name: string | null;
  courier_status: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_terms: string | null;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  review_amount_due: number;
  fee: number;
  created_at: string;
  is_deleted: boolean;
};

export type CaseStudyReportCustomer = {
  id: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
};

export type CaseStudyReportProduct = {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  image_url: string | null;
};

export type CaseStudyReportSalesItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  variant_image_url: string | null;
  quantity: number;
  total: number;
  source: "sales_items" | "sale_items";
  sales: {
    created_at: string;
    customer_id: string | null;
    customer_name: string;
    invoice_number: string;
    courier_status: string | null;
    payment_status: string | null;
    is_deleted: boolean;
  };
};

export type CaseStudyReportDiagnostics = {
  totalSales: number;
  successfulSales: number;
  cancelledSales: number;
  directSalesItemRows: number;
  legacySaleItemRows: number;
  mergedSalesItemRows: number;
  salesWithItems: number;
  salesWithoutItems: number;
  recoveredFromLegacyItems: number;
  missingItemInvoices: string[];
  warnings: string[];
};

export type CaseStudyReportMeta = {
  source: "api" | "supabase_fallback";
  notice?: string;
};

export type CaseStudyReportDataset = {
  sales: CaseStudyReportSale[];
  customers: CaseStudyReportCustomer[];
  products: CaseStudyReportProduct[];
  salesItems: CaseStudyReportSalesItem[];
  diagnostics: CaseStudyReportDiagnostics;
  meta?: CaseStudyReportMeta;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
};

const isCaseStudyApiUnavailable = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /cannot connect to api|failed to fetch|networkerror|err_connection_refused|econnrefused|service unavailable|statuscode":503|platform db is unavailable|getaddrinfo enotfound|enotfound/i.test(
    message,
  );
};

const isMissingRelationError = (error: { code?: string; message?: string } | null): boolean => {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("relation")
  );
};

const chunk = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeSaleRow = (row: LooseRow): CaseStudyReportSale => ({
  id: String(row.id ?? ""),
  invoice_number: String(row.invoice_number ?? ""),
  customer_id: row.customer_id ? String(row.customer_id) : null,
  customer_name: String(row.customer_name ?? ""),
  customer_phone: row.customer_phone ? String(row.customer_phone) : null,
  customer_whatsapp: row.customer_whatsapp ? String(row.customer_whatsapp) : null,
  customer_address: row.customer_address ? String(row.customer_address) : null,
  courier_name: row.courier_name ? String(row.courier_name) : null,
  courier_status: row.courier_status ? String(row.courier_status) : null,
  payment_method: row.payment_method ? String(row.payment_method) : null,
  payment_status: row.payment_status ? String(row.payment_status) : null,
  payment_terms: row.payment_terms ? String(row.payment_terms) : null,
  grand_total: Number(row.grand_total ?? 0) || 0,
  amount_paid: Number(row.amount_paid ?? 0) || 0,
  amount_due: Number(row.amount_due ?? 0) || 0,
  review_amount_due: Number(row.review_amount_due ?? 0) || 0,
  fee: Number(row.fee ?? 0) || 0,
  created_at: String(row.created_at ?? new Date().toISOString()),
  is_deleted: Boolean(row.is_deleted),
});

const normalizeCustomerRow = (row: LooseRow): CaseStudyReportCustomer => ({
  id: String(row.id ?? ""),
  phone: row.phone ? String(row.phone) : null,
  whatsapp: row.whatsapp ? String(row.whatsapp) : null,
  address: row.address ? String(row.address) : null,
});

const normalizeProductRow = (row: LooseRow): CaseStudyReportProduct => ({
  id: String(row.id ?? ""),
  name: String(row.name ?? ""),
  sku: row.sku ? String(row.sku) : null,
  stock_quantity: Number(row.stock_quantity ?? 0) || 0,
  image_url: row.image_url ? String(row.image_url) : null,
});

const isExcludedSale = (sale: Pick<CaseStudyReportSale, "courier_status" | "payment_status">): boolean => {
  const courierStatus = String(sale.courier_status ?? "").toLowerCase();
  const paymentStatus = String(sale.payment_status ?? "").toLowerCase();
  return (
    courierStatus.includes("cancel") ||
    courierStatus.includes("return") ||
    courierStatus.includes("lost") ||
    paymentStatus === "cancelled"
  );
};

const isSuccessfulSale = (sale: Pick<CaseStudyReportSale, "courier_status" | "payment_status">): boolean => {
  if (isExcludedSale(sale)) return false;
  const courierStatus = String(sale.courier_status ?? "").toLowerCase();
  const paymentStatus = String(sale.payment_status ?? "").toLowerCase();
  return (
    courierStatus.includes("delivered") ||
    courierStatus.includes("completed") ||
    paymentStatus === "paid" ||
    paymentStatus === "pending" ||
    paymentStatus === "partial"
  );
};

const resolveCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user ?? null;
};

const resolveCurrentTenantId = async (): Promise<string | null> => {
  const { data, error } = await (supabase as any).rpc("current_tenant_id");
  if (!error && data) {
    return String(data);
  }

  const user = await resolveCurrentUser();
  return (
    (user?.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    (user?.user_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    null
  );
};

const selectItemRows = async (
  table: "sales_items" | "sale_items",
  saleIds: string[],
  tenantId: string | null,
): Promise<LooseRow[]> => {
  if (saleIds.length === 0) {
    return [];
  }

  const rows: LooseRow[] = [];

  for (const batch of chunk(saleIds, BATCH_SIZE)) {
    let batchRows: LooseRow[] | null = null;
    let lastError: { code?: string; message?: string } | null = null;

    for (const selectClause of ITEM_SELECT_VARIANTS) {
      let query = (supabase as any).from(table).select(selectClause).in("sale_id", batch);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const result = await query;
      if (!result.error) {
        batchRows = (result.data ?? []) as LooseRow[];
        break;
      }

      lastError = result.error;
      if (!isMissingRelationError(result.error)) {
        throw new Error(result.error.message || `Failed to query ${table}`);
      }
    }

    if (!batchRows) {
      if (lastError && !isMissingRelationError(lastError)) {
        throw new Error(lastError.message || `Failed to query ${table}`);
      }
      return [];
    }

    rows.push(...batchRows);
  }

  return rows;
};

const mergeSalesItems = (
  sales: CaseStudyReportSale[],
  directRows: LooseRow[],
  legacyRows: LooseRow[],
): CaseStudyReportSalesItem[] => {
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const merged = new Map<string, CaseStudyReportSalesItem>();

  const upsertRows = (rows: LooseRow[], source: "sales_items" | "sale_items") => {
    rows.forEach((row, index) => {
      const saleId = String(row.sale_id ?? "");
      const sale = salesById.get(saleId);
      if (!sale) {
        return;
      }

      const itemId = String(row.id ?? `${source}:${saleId}:${index}`);
      const existing = merged.get(itemId);
      const nextItem: CaseStudyReportSalesItem = {
        id: itemId,
        sale_id: saleId,
        product_id: row.product_id ? String(row.product_id) : null,
        product_name: String(row.product_name ?? ""),
        product_image_url: row.product_image_url ? String(row.product_image_url) : null,
        variant_image_url: row.variant_image_url ? String(row.variant_image_url) : null,
        quantity: Number(row.quantity ?? 0) || 0,
        total: Number(row.total ?? 0) || 0,
        source,
        sales: {
          created_at: sale.created_at,
          customer_id: sale.customer_id,
          customer_name: sale.customer_name,
          invoice_number: sale.invoice_number,
          courier_status: sale.courier_status,
          payment_status: sale.payment_status,
          is_deleted: sale.is_deleted,
        },
      };

      if (!existing) {
        merged.set(itemId, nextItem);
        return;
      }

      merged.set(itemId, {
        ...existing,
        product_id: existing.product_id ?? nextItem.product_id,
        product_name: existing.product_name || nextItem.product_name,
        product_image_url: existing.product_image_url ?? nextItem.product_image_url,
        variant_image_url: existing.variant_image_url ?? nextItem.variant_image_url,
        quantity: existing.quantity || nextItem.quantity,
        total: existing.total || nextItem.total,
        source: existing.source === "sales_items" ? existing.source : nextItem.source,
      });
    });
  };

  upsertRows(directRows, "sales_items");
  upsertRows(legacyRows, "sale_items");

  return Array.from(merged.values());
};

const loadCustomers = async (
  customerIds: string[],
  tenantId: string | null,
): Promise<CaseStudyReportCustomer[]> => {
  if (customerIds.length === 0) {
    return [];
  }

  const rows: LooseRow[] = [];
  for (const batch of chunk(customerIds, BATCH_SIZE)) {
    let query = (supabase as any).from("customers").select(CUSTOMER_SELECT).in("id", batch);
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const result = await query;
    if (result.error) {
      throw new Error(result.error.message || "Failed to load customers");
    }
    rows.push(...((result.data ?? []) as LooseRow[]));
  }

  return rows.map(normalizeCustomerRow);
};

const loadProducts = async (
  productIds: string[],
  tenantId: string | null,
): Promise<CaseStudyReportProduct[]> => {
  if (productIds.length === 0) {
    return [];
  }

  const rows: LooseRow[] = [];
  for (const batch of chunk(productIds, BATCH_SIZE)) {
    let query = (supabase as any).from("products").select(PRODUCT_SELECT).in("id", batch);
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const result = await query;
    if (result.error) {
      throw new Error(result.error.message || "Failed to load products");
    }
    rows.push(...((result.data ?? []) as LooseRow[]));
  }

  return rows.map(normalizeProductRow);
};

const buildDiagnostics = (
  sales: CaseStudyReportSale[],
  directItems: LooseRow[],
  legacyItems: LooseRow[],
  mergedItems: CaseStudyReportSalesItem[],
): CaseStudyReportDiagnostics => {
  const directSaleIds = new Set(
    directItems
      .map((row) => String(row.sale_id ?? ""))
      .filter((saleId) => saleId.length > 0),
  );
  const legacySaleIds = new Set(
    legacyItems
      .map((row) => String(row.sale_id ?? ""))
      .filter((saleId) => saleId.length > 0),
  );
  const mergedSaleIds = new Set(mergedItems.map((item) => item.sale_id));
  const missingSales = sales.filter((sale) => !mergedSaleIds.has(sale.id));
  const successfulSales = sales.filter((sale) => isSuccessfulSale(sale));
  const cancelledSales = sales.filter((sale) => isExcludedSale(sale));
  let recoveredFromLegacyItems = 0;

  sales.forEach((sale) => {
    if (!directSaleIds.has(sale.id) && legacySaleIds.has(sale.id)) {
      recoveredFromLegacyItems += 1;
    }
  });

  const warnings: string[] = [];
  if (sales.length === 0) {
    warnings.push("No booked orders were found in the selected period.");
  }
  if (successfulSales.length === 0 && sales.length > 0) {
    warnings.push(
      "No orders matched the recognized revenue rules. Weekly revenue rhythm and courier revenue mix will remain empty until orders are delivered, completed, paid, pending, or partial.",
    );
  }
  if (missingSales.length > 0) {
    warnings.push(
      `${missingSales.length} booked order${missingSales.length === 1 ? "" : "s"} have no recoverable line items in sales_items or sale_items. Item-based sections will stay incomplete for those orders.`,
    );
  }
  if (recoveredFromLegacyItems > 0) {
    warnings.push(
      `Recovered item movement from legacy sale_items rows for ${recoveredFromLegacyItems} order${recoveredFromLegacyItems === 1 ? "" : "s"}.`,
    );
  }

  return {
    totalSales: sales.length,
    successfulSales: successfulSales.length,
    cancelledSales: cancelledSales.length,
    directSalesItemRows: directItems.length,
    legacySaleItemRows: legacyItems.length,
    mergedSalesItemRows: mergedItems.length,
    salesWithItems: mergedSaleIds.size,
    salesWithoutItems: missingSales.length,
    recoveredFromLegacyItems,
    missingItemInvoices: missingSales
      .map((sale) => sale.invoice_number)
      .filter((invoiceNumber) => invoiceNumber.length > 0)
      .slice(0, 10),
    warnings,
  };
};

const loadCaseStudyReportDatasetDirect = async ({
  from,
  to,
  notice,
}: {
  from?: Date;
  to?: Date;
  notice?: string;
}): Promise<CaseStudyReportDataset> => {
  const tenantId = await resolveCurrentTenantId();

  let salesQuery = (supabase as any)
    .from("sales")
    .select(SALES_SELECT)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (tenantId) {
    salesQuery = salesQuery.eq("tenant_id", tenantId);
  }
  if (from) {
    salesQuery = salesQuery.gte("created_at", from.toISOString());
  }
  if (to) {
    salesQuery = salesQuery.lte("created_at", to.toISOString());
  }

  const salesResult = await salesQuery;
  if (salesResult.error) {
    throw new Error(salesResult.error.message || "Failed to load report sales");
  }

  const sales = ((salesResult.data ?? []) as LooseRow[]).map(normalizeSaleRow);
  const saleIds = sales.map((sale) => sale.id).filter((saleId) => saleId.length > 0);

  const directItems = await selectItemRows("sales_items", saleIds, tenantId);
  const legacyItems: LooseRow[] = [];

  const salesItems = mergeSalesItems(sales, directItems, legacyItems);

  const customerIds = Array.from(
    new Set(
      sales
        .map((sale) => sale.customer_id)
        .filter((customerId): customerId is string => Boolean(customerId)),
    ),
  );
  const productIds = Array.from(
    new Set(
      salesItems
        .map((item) => item.product_id)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  );

  const [customers, products] = await Promise.all([
    loadCustomers(customerIds, tenantId),
    loadProducts(productIds, tenantId),
  ]);

  return {
    sales,
    customers,
    products,
    salesItems,
    diagnostics: buildDiagnostics(sales, directItems, legacyItems, salesItems),
    meta: {
      source: "supabase_fallback",
      notice,
    },
  };
};

export const getCaseStudyReportDataset = async (params: {
  from?: Date;
  to?: Date;
}): Promise<CaseStudyReportDataset> => {
  const searchParams = new URLSearchParams();

  if (params.from) {
    searchParams.set("from", params.from.toISOString());
  }
  if (params.to) {
    searchParams.set("to", params.to.toISOString());
  }

  const suffix = searchParams.toString();
  const path = suffix ? `/reports/case-study-dataset?${suffix}` : "/reports/case-study-dataset";

  if (shouldPreferDirectCaseStudyDataset(configuredApiUrl)) {
    return loadCaseStudyReportDatasetDirect({
      from: params.from,
      to: params.to,
    });
  }

  if (!configuredApiUrl) {
    return loadCaseStudyReportDatasetDirect({
      from: params.from,
      to: params.to,
      notice: "This report loaded directly from Supabase because the client has no API URL configured.",
    });
  }

  try {
    const dataset = await invokeProtectedApi<CaseStudyReportDataset>(path);
    return {
      ...dataset,
      meta: {
        source: "api",
      },
    };
  } catch (error) {
    if (!isCaseStudyApiUnavailable(error)) {
      throw error;
    }

    try {
      return await loadCaseStudyReportDatasetDirect({
        from: params.from,
        to: params.to,
        notice: "This report loaded directly from Supabase because the reports API is currently unavailable.",
      });
    } catch (fallbackError) {
      const apiMessage = getErrorMessage(error) || "The reports API is unavailable.";
      const fallbackMessage = getErrorMessage(fallbackError) || "Unknown fallback error.";
      throw new Error(`${apiMessage} Direct Supabase fallback failed: ${fallbackMessage}`);
    }
  }
};
