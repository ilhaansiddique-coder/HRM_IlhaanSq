import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/utils/toast";
import { upsertCustomerWithServerAccess } from "@/modules/inventory/services/customersService";
import {
  createSaleWithServerAccess,
  isSaleApiUnavailableError,
} from "@/modules/inventory/services/salesService";
import { sendInvoiceWebhook, prepareInvoiceData } from "@/modules/inventory/services/invoicesService";
import { parseVariantAttributes } from "@/utils/variantAttributes";
import { generateUUID } from "@/lib/uuid";
import { backendAccessMode } from "@/lib/backendAccessPolicy";
import { appLogger } from "@/utils/logger";
import { useTenantMembership } from "@/hooks/useTenantMembership";

let salesSchemaCompatibilityBlocked = false;
let salesCreditTermsSchemaMissing = false;

const SALES_CREDIT_TERM_FIELDS = ["payment_terms", "credit_days", "due_date"] as const;

const isMissingSalesCreditTermsSchemaError = (
  queryError: { code?: string; message?: string } | null | undefined,
) => {
  if (!queryError) return false;
  const message = String(queryError.message || "").toLowerCase();
  return SALES_CREDIT_TERM_FIELDS.some((field) => message.includes(field)) && (
    queryError.code === "42703" ||
    queryError.code === "PGRST204" ||
    queryError.code === "PGRST100" ||
    String(queryError.code || "").toUpperCase().startsWith("PGRST") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("parse")
  );
};

const stripSalesCreditTermFields = <T extends Record<string, unknown>>(payload: T) => {
  const nextPayload = { ...payload };
  SALES_CREDIT_TERM_FIELDS.forEach((field) => {
    delete nextPayload[field];
  });
  return nextPayload as Omit<T, (typeof SALES_CREDIT_TERM_FIELDS)[number]>;
};

const buildSaleDetailsSelect = (options?: {
  includeCourierName?: boolean;
  includeTrackingNumber?: boolean;
  includeCreditTerms?: boolean;
}) => {
  const columns = [
    "id",
    "invoice_number",
    "customer_id",
    "customer_name",
    "customer_phone",
    "customer_whatsapp",
    "customer_address",
    "additional_info",
    "cn_number",
    options?.includeCourierName === false ? null : "courier_name",
    "consignment_id",
    options?.includeTrackingNumber === false ? null : "tracking_number",
    "cancelled_at",
    "returned_at",
    "lost_at",
    "status_changed_at",
    "payment_method",
    "payment_status",
    options?.includeCreditTerms === false ? null : "payment_terms",
    options?.includeCreditTerms === false ? null : "credit_days",
    options?.includeCreditTerms === false ? null : "due_date",
    "courier_status",
    "packaged",
    "subtotal",
    "discount_percent",
    "discount_amount",
    "grand_total",
    "amount_paid",
    "amount_due",
    "review_amount_paid",
    "review_amount_due",
    "fee",
    "created_at",
    "updated_at",
  ].filter(Boolean);

  return columns.join(", ");
};

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  customer_address: string | null;
  additional_info?: string | null;
  cn_number?: string | null;
  courier_name?: string | null;
  cancelled_at?: string | null;
  returned_at?: string | null;
  lost_at?: string | null;
  status_changed_at?: string | null;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  review_amount_paid?: number | null;
  review_amount_due?: number | null;
  payment_method: string;
  payment_status: string;
  payment_terms?: 'immediate' | 'cod' | 'credit';
  credit_days?: number;
  due_date?: string | null;
  order_status?: string;
  courier_status?: string;
  consignment_id?: string;
  tracking_number?: string;
  last_status_check?: string;
  packaged?: boolean;
  fee?: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  sale_payments?: Array<{ method: string; amount: number }>;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  product_image_url?: string | null;
  quantity: number;
  rate: number;
  sale_price?: number | null;
  total: number;
  created_at: string;
  variant_id?: string | null;
  variant_image_url?: string | null;
  variant_attributes?: Record<string, string> | string | string[] | null;
  attributes?: Record<string, string> | string | string[] | null;
  variant_label?: string | null;
  description_for_print?: string | null;
}

export interface CreateSaleData {
  id?: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  additional_info?: string;
  cn_number?: string;
  courier_name?: string;
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  fee?: number;
  grand_total: number;
  amount_paid?: number;
  amount_due?: number;
  review_amount_paid?: number;
  review_amount_due?: number;
  payment_method: string;
  payment_status?: string;
  payment_terms?: 'immediate' | 'cod' | 'credit';
  credit_days?: number | null;
  due_date?: string | null;
  payment_splits?: Array<{ method: string; amount: number }>;
  created_at?: string;
  items: {
    product_id: string | null;
    product_name: string;
    product_image_url?: string | null;
    quantity: number;
    rate: number;
    sale_price?: number | null;
    total: number;
    variant_id?: string | null;
    variant_image_url?: string | null;
  }[];
}

export interface UpdateSaleData {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  additional_info?: string;
  cn_number?: string;
  courier_name?: string;
  city?: string;
  zone?: string;
  area?: string;
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  fee?: number;
  grand_total: number;
  amount_paid?: number;
  amount_due?: number;
  review_amount_paid?: number;
  review_amount_due?: number;
  payment_method: string;
  payment_status?: string;
  payment_terms?: 'immediate' | 'cod' | 'credit';
  credit_days?: number | null;
  due_date?: string | null;
  payment_splits?: Array<{ method: string; amount: number }>;
  courier_status?: string | null;
  consignment_id?: string | null;
  tracking_number?: string | null;
  created_at?: string;
  items: {
    id?: string;
    product_id: string | null;
    product_name: string;
    product_image_url?: string | null;
    quantity: number;
    rate: number;
    sale_price?: number | null;
    total: number;
    variant_id?: string | null;
    variant_image_url?: string | null;
  }[];
}

export const useSales = (queryKey: string = "sales") => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const salesQueryKey = [queryKey, tenantId] as const;
  const tenantRealtimeFilter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;

  const scheduleBackgroundTask = (task: () => Promise<void>, label: string) => {
    window.setTimeout(() => {
      void task().catch((error) => {
        console.error(`Background task failed: ${label}`, error);
      });
    }, 0);
  };

  useEffect(() => {
    if (backendAccessMode === "api_first") {
      appLogger.warn(
        "Sales module is still using direct Supabase RLS access while NEXT_PUBLIC_BACKEND_ACCESS_MODE=api_first.",
      );
    }
  }, []);

  const normalizeName = (name?: string | null) =>
    (name || "").toLowerCase().replace(/\s+/g, " ").trim();

  const normalizePhoneDigits = (phone?: string | null) =>
    (phone || "").replace(/[^\d]/g, "");

  const buildPhoneIlikePattern = (digits: string) => {
    // Additional security: ensure only digits (should already be sanitized by normalizePhoneDigits)
    const sanitizedDigits = digits.replace(/[^\d]/g, "");
    if (!sanitizedDigits) return "";
    // Limit length to prevent DoS with extremely long patterns
    const limitedDigits = sanitizedDigits.slice(0, 20);
    return `%${limitedDigits.split("").join("%")}%`;
  };

  const buildWhatsappFromPhone = (phone?: string | null) => {
    const digits = normalizePhoneDigits(phone);
    if (!digits) return null;
    return digits.startsWith("88") ? `+${digits}` : `+88${digits}`;
  };

  const isCancelledStatus = (paymentStatus?: string | null, courierStatus?: string | null) => {
    const cancelledCourierStates = ["cancelled", "returned", "lost"];
    return paymentStatus === "cancelled" || (courierStatus ? cancelledCourierStates.includes(courierStatus) : false);
  };

  const normalizePaymentSplits = (
    splits: Array<{ method: string; amount: number }> | undefined,
    fallbackMethod: string | undefined,
    fallbackAmount: number | undefined
  ) => {
    const normalized = (splits || [])
      .map((split) => {
        const method = String(split.method || "").trim() || "cash";
        return {
          method: method === "condition" ? "cod" : method,
          amount: Number(split.amount) || 0,
        };
      })
      .filter((split) => split.amount > 0);

    if (normalized.length === 0 && (fallbackAmount || 0) > 0) {
      const method = fallbackMethod === "condition" ? "cod" : (fallbackMethod || "cash");
      return [{
        method,
        amount: fallbackAmount || 0,
      }];
    }

    return normalized;
  };

  // Function to update customer status after sale changes
  const updateCustomerStatus = async (customerId?: string) => {
    if (!customerId || !tenantId) return;

    try {
      // Get customer's purchase history to calculate new status
      // Since we're using hard delete, just fetch all sales for this customer
      const { data: sales, error } = await supabase
        .from('sales')
        .select('created_at, payment_status, courier_status')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .not('payment_status', 'eq', 'cancelled')
        .not('courier_status', 'in', '(cancelled,returned,lost)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer sales:', error);
        return;
      }

      let newStatus = 'inactive';
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      if (sales && sales.length > 0) {
        const lastPurchase = new Date(sales[0].created_at);

        if (lastPurchase >= oneMonthAgo) {
          newStatus = 'active';
        } else if (lastPurchase >= threeMonthsAgo) {
          newStatus = 'neutral';
        } else {
          newStatus = 'inactive';
        }
      }

      // Update customer status
      await upsertCustomerWithServerAccess({
        id: customerId,
        data: { status: newStatus },
      });
    } catch (error) {
      console.error('Error in updateCustomerStatus:', error);
    }
  };

  const {
    data: sales = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: salesQueryKey,
    queryFn: async () => {
      try {
        if (salesSchemaCompatibilityBlocked) {
          return [] as Sale[];
        }
        if (!tenantId) {
          return [] as Sale[];
        }

        const isSchemaCompatibilityError = (queryError: { code?: string; message?: string } | null) => {
          if (!queryError) return false;
          const msg = String(queryError.message || "").toLowerCase();
          return (
            queryError.code === "42703" ||
            queryError.code === "PGRST204" ||
            queryError.code === "PGRST100" ||
            queryError.code === "22P02" ||
            String(queryError.code || "").toUpperCase().startsWith("PGRST") ||
            msg.includes("does not exist") ||
            msg.includes("column") ||
            msg.includes("relationship") ||
            msg.includes("schema cache") ||
            msg.includes("parse")
          );
        };
        const { data: rawSalesRows, error: salesError } = await supabase
          .from("sales")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (salesError) {
          if (isSchemaCompatibilityError(salesError)) {
            salesSchemaCompatibilityBlocked = true;
            return [] as Sale[];
          }
          throw salesError;
        }

        const visibleSalesRows = (rawSalesRows as Array<Record<string, unknown>>).filter(
          (sale) => sale.is_deleted !== true,
        );
        const saleIds = visibleSalesRows
          .map((sale) => String(sale.id || ""))
          .filter((id) => id.length > 0);

        const paymentMap = new Map<string, Array<{ method: string; amount: number }>>();
        if (saleIds.length > 0) {
          const { data: paymentRows, error: paymentError } = await supabase
            .from("sale_payments")
            .select("sale_id, method, amount")
            .eq("tenant_id", tenantId)
            .in("sale_id", saleIds);

          if (!paymentError && paymentRows) {
            for (const row of paymentRows as Array<{ sale_id: string; method: string; amount: number }>) {
              const entries = paymentMap.get(row.sale_id) || [];
              entries.push({ method: row.method, amount: Number(row.amount) || 0 });
              paymentMap.set(row.sale_id, entries);
            }
          }
        }

        return visibleSalesRows.map((sale) => {
          const id = String(sale.id || "");
          return {
            id,
            invoice_number: String(sale.invoice_number || ""),
            customer_id: (sale.customer_id as string | null) ?? null,
            customer_name: String(sale.customer_name || ""),
            customer_phone: (sale.customer_phone as string | null) ?? null,
            customer_whatsapp: (sale.customer_whatsapp as string | null) ?? null,
            customer_address: (sale.customer_address as string | null) ?? null,
            additional_info: (sale.additional_info as string | null) ?? null,
            cn_number: (sale.cn_number as string | null) ?? null,
            courier_name: (sale.courier_name as string | null) ?? null,
            cancelled_at: (sale.cancelled_at as string | null) ?? null,
            returned_at: (sale.returned_at as string | null) ?? null,
            lost_at: (sale.lost_at as string | null) ?? null,
            status_changed_at: (sale.status_changed_at as string | null) ?? null,
            subtotal: Number(sale.subtotal || 0),
            discount_percent: Number(sale.discount_percent || 0),
            discount_amount: Number(sale.discount_amount || 0),
            grand_total: Number(sale.grand_total || 0),
            amount_paid: Number(sale.amount_paid || 0),
            amount_due: Number(sale.amount_due || 0),
            review_amount_paid: Number(sale.review_amount_paid || 0),
            review_amount_due: Number(sale.review_amount_due || 0),
            payment_method: String(sale.payment_method || "cash"),
            payment_status: String(sale.payment_status || "pending"),
            payment_terms: ((sale.payment_terms as "immediate" | "cod" | "credit" | null) ?? "immediate"),
            credit_days: Number(sale.credit_days || 0),
            due_date: (sale.due_date as string | null) ?? null,
            order_status: (sale.order_status as string | null) ?? undefined,
            courier_status: (sale.courier_status as string | null) ?? undefined,
            consignment_id: (sale.consignment_id as string | null) ?? undefined,
            tracking_number: (sale.tracking_number as string | null) ?? undefined,
            last_status_check: (sale.last_status_check as string | null) ?? undefined,
            fee: Number(sale.fee || 0),
            packaged: Boolean(sale.packaged),
            created_at: String(sale.created_at || new Date().toISOString()),
            updated_at: String(sale.updated_at || sale.created_at || new Date().toISOString()),
            created_by: (sale.created_by as string | null) ?? null,
            is_deleted: Boolean(sale.is_deleted),
            deleted_at: (sale.deleted_at as string | null) ?? null,
            sale_payments: paymentMap.get(id) || [],
          } as Sale;
        });
      } catch (error) {
        const errorWithMeta = error as { code?: string; message?: string } | null;
        if (
          errorWithMeta &&
          (errorWithMeta.code === "42703" ||
            errorWithMeta.code === "PGRST204" ||
            errorWithMeta.code === "PGRST100" ||
            String(errorWithMeta.code || "").toUpperCase().startsWith("PGRST") ||
            /does not exist|schema cache|column|relationship|parse/i.test(String(errorWithMeta.message || "")))
        ) {
          salesSchemaCompatibilityBlocked = true;
          return [] as Sale[];
        }
        console.error("Failed to load sale data:", error);
        throw error;
      }
    },
    enabled: !!user && !!tenantId,
    staleTime: 0, // Always refetch when invalidated by realtime events
    retry: false,
  });

  // Real-time: instantly update sales cache on changes
  useEffect(() => {
    if (!user || !tenantId || !tenantRealtimeFilter) return;

    const channel = supabase
      .channel(`sales-realtime-${queryKey}-${tenantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sales", filter: tenantRealtimeFilter }, (payload) => {
        // Instant cache update for sales field changes (courier_status, payment_status, amounts, etc.)
        const updated = payload.new as Record<string, any>;
        queryClient.setQueryData(salesQueryKey, (old: Sale[] | undefined) => {
          if (!old) return old;
          return old.map((sale) =>
            sale.id === updated.id ? { ...sale, ...updated } : sale
          );
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales", filter: tenantRealtimeFilter }, () => {
        // New sale created — need full refetch to get joined data
        queryClient.invalidateQueries({ queryKey: salesQueryKey });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sales", filter: tenantRealtimeFilter }, (payload) => {
        const deleted = payload.old as Record<string, any>;
        queryClient.setQueryData(salesQueryKey, (old: Sale[] | undefined) => {
          if (!old) return old;
          return old.filter((sale) => sale.id !== deleted.id);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_items", filter: tenantRealtimeFilter }, () => {
        queryClient.invalidateQueries({ queryKey: salesQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_payments", filter: tenantRealtimeFilter }, () => {
        queryClient.invalidateQueries({ queryKey: salesQueryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, salesQueryKey, tenantId, tenantRealtimeFilter, user]);

  const getStockFailureMessage = (error: any) => {
    const raw = String(error?.message || error || "");
    if (raw.toLowerCase().includes("insufficient stock")) {
      return "Insufficient stock. This product is already sold out.";
    }
    if (raw.toLowerCase().includes("product not found")) {
      return "Product not found for stock update.";
    }
    if (raw.toLowerCase().includes("variant not found")) {
      return "Variant not found for stock update.";
    }
    return raw;
  };

  const getInsufficientStockDetails = async (items: Array<any>) => {
    const productIds = Array.from(
      new Set(items.map((item) => item.product_id).filter(Boolean))
    ) as string[];
    const variantIds = Array.from(
      new Set(items.map((item) => item.variant_id).filter(Boolean))
    ) as string[];

    const [productsResult, variantsResult] = await Promise.all([
      productIds.length
        ? supabase.from("products").select("id, stock_quantity").eq("tenant_id", tenantId).in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      variantIds.length
        ? supabase.from("product_variants").select("id, stock_quantity").eq("tenant_id", tenantId).in("id", variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (variantsResult.error) throw variantsResult.error;

    const productStockMap = new Map<string, number>();
    (productsResult.data || []).forEach((row: any) => {
      productStockMap.set(row.id, Number(row.stock_quantity) || 0);
    });

    const variantStockMap = new Map<string, number>();
    (variantsResult.data || []).forEach((row: any) => {
      variantStockMap.set(row.id, Number(row.stock_quantity) || 0);
    });

    const firstInsufficient = items.find((item) => {
      const qty = Number(item.quantity) || 0;
      if (item.variant_id) {
        const stock = variantStockMap.get(item.variant_id) ?? 0;
        return qty > stock;
      }
      const stock = productStockMap.get(item.product_id) ?? 0;
      return qty > stock;
    });

    if (!firstInsufficient) return null;

    const stock = firstInsufficient.variant_id
      ? variantStockMap.get(firstInsufficient.variant_id) ?? 0
      : productStockMap.get(firstInsufficient.product_id) ?? 0;

    return {
      name: firstInsufficient.product_name || "Product",
      stock,
    };
  };

  const createSale = useMutation({
    mutationFn: async (saleData: CreateSaleData) => {
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      const saleId = saleData.id ?? generateUUID();
      const { items, id, payment_splits, ...saleInfo } = saleData;
      const saleWhatsapp = saleInfo.customer_whatsapp || buildWhatsappFromPhone(saleInfo.customer_phone);
      const normalizedAmountPaid = saleInfo.amount_paid ?? 0;
      const paymentSplits = normalizePaymentSplits(
        payment_splits,
        saleInfo.payment_method,
        normalizedAmountPaid
      );
      const saleInfoWithWhatsapp = {
        ...saleInfo,
        customer_whatsapp: saleWhatsapp,
        payment_method: saleInfo.payment_method,
      };

      const { data: existingSale, error: existingSaleError } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingSaleError) throw existingSaleError;

      if (existingSale) {
        try {
          return await createSaleWithServerAccess({
            sale: { id: saleId },
            items: items.map(item => ({
              ...item,
              sale_id: saleId,
            })),
            paymentSplits,
          }) as unknown as Sale;
        } catch (serverError) {
          if (!isSaleApiUnavailableError(serverError)) {
            throw serverError;
          }
        }

        return existingSale as unknown as Sale;
      }

      // Generate invoice number
      const { data: invoiceData, error: invoiceError } = await supabase
        .rpc('generate_invoice_number');

      if (invoiceError) throw invoiceError;
      const initialCancelled = isCancelledStatus(saleInfoWithWhatsapp.payment_status, (saleInfoWithWhatsapp as any).courier_status);

      // Check if customer exists or create new one if needed
      let finalCustomerId = saleInfoWithWhatsapp.customer_id;

      if (!finalCustomerId && saleInfoWithWhatsapp.customer_name) {
        const normalizedName = normalizeName(saleInfoWithWhatsapp.customer_name);
        const normalizedPhone = normalizePhoneDigits(saleInfoWithWhatsapp.customer_phone);
        let existingCustomerId: string | null = null;

        if (normalizedPhone) {
          const pattern = buildPhoneIlikePattern(normalizedPhone);
          // Only query if we have a valid pattern
          if (pattern) {
            const { data: candidates } = await supabase
              .from("customers")
              .select("id, name, phone, whatsapp")
              .eq("tenant_id", tenantId)
              .or(`phone.ilike.${pattern},whatsapp.ilike.${pattern}`)
              .limit(10);

            const matched = (candidates || []).find(candidate => {
              const candidatePhone = normalizePhoneDigits(candidate.phone);
              const candidateWhatsapp = normalizePhoneDigits(candidate.whatsapp);
              return candidatePhone === normalizedPhone || candidateWhatsapp === normalizedPhone;
            });

            if (matched) {
              existingCustomerId = matched.id;
            } else if (normalizedName) {
              const { data: nameCandidates } = await supabase
                .from("customers")
                .select("id, name, phone, whatsapp")
                .eq("tenant_id", tenantId)
                .ilike("name", normalizedName)
                .limit(10);

              const nameOnlyMatch = (nameCandidates || []).find(candidate => {
                if (normalizeName(candidate.name) !== normalizedName) return false;
                const candidatePhone = normalizePhoneDigits(candidate.phone);
                const candidateWhatsapp = normalizePhoneDigits(candidate.whatsapp);
                return !candidatePhone && !candidateWhatsapp;
              });

              if (nameOnlyMatch) {
                existingCustomerId = nameOnlyMatch.id;
              }
            }
          }
        } else if (normalizedName) {
          const { data: nameCandidates } = await supabase
            .from("customers")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .ilike("name", normalizedName)
            .limit(10);

          const nameMatch = (nameCandidates || []).find(candidate =>
            normalizeName(candidate.name) === normalizedName
          );

          if (nameMatch) {
            existingCustomerId = nameMatch.id;
          }
        }

        if (existingCustomerId) {
          finalCustomerId = existingCustomerId;
        } else {
          const newCustomer = await upsertCustomerWithServerAccess({
            data: {
              name: saleInfoWithWhatsapp.customer_name,
              phone: saleInfoWithWhatsapp.customer_phone || null,
              whatsapp: saleInfoWithWhatsapp.customer_whatsapp || null,
              address: saleInfoWithWhatsapp.customer_address || null,
              status: "active",
            },
          });
          finalCustomerId = newCustomer.id;
        }
      }

      // Create sale
      const insertPayload = {
        id: saleId,
        ...saleInfoWithWhatsapp,
        customer_id: finalCustomerId,
        invoice_number: invoiceData,
        tenant_id: tenantId,
      };

      const saleItems = items.map(item => ({
        ...item,
        sale_id: saleId,
        tenant_id: tenantId,
      }));

      try {
        return await createSaleWithServerAccess({
          sale: insertPayload,
          items: saleItems,
          paymentSplits,
        }) as unknown as Sale;
      } catch (serverError) {
        if (!isSaleApiUnavailableError(serverError)) {
          throw serverError;
        }
      }

      let saleResult = await supabase
        .from("sales")
        .insert([insertPayload])
        .select()
        .single();

      if (saleResult.error && isMissingSalesCreditTermsSchemaError(saleResult.error)) {
        salesCreditTermsSchemaMissing = true;
        saleResult = await supabase
          .from("sales")
          .insert([stripSalesCreditTermFields(insertPayload)])
          .select()
          .single();
      }

      if (saleResult.error) throw saleResult.error;
      const sale = saleResult.data;

      const { error: itemsError } = await supabase
        .from("sales_items")
        .insert(saleItems.map(item => ({
          ...item,
          sale_id: sale.id,
        })));

      if (itemsError) {
        const raw = String(itemsError.message || "");
        if (raw.toLowerCase().includes("insufficient stock")) {
          const details = await getInsufficientStockDetails(saleItems);
          if (details) {
            throw new Error(`Insufficient stock for ${details.name}. Left in stock: ${details.stock}.`);
          }
        }
        throw itemsError;
      }

      if (paymentSplits.length > 0) {
        const splitRows = paymentSplits.map((split) => ({
          sale_id: sale.id,
          method: split.method,
          amount: split.amount,
          tenant_id: tenantId,
        }));
        const { error: splitError } = await supabase
          .from("sale_payments")
          .insert(splitRows);
        if (splitError) throw splitError;
      }

      // Stock adjustments are handled by database triggers; no client-side adjustments here.

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: salesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      // Update customer status automatically
      if (sale.customer_id) {
        scheduleBackgroundTask(
          async () => {
            await updateCustomerStatus(sale.customer_id);
          },
          `updateCustomerStatus:${sale.customer_id}`,
        );
      }

      toast.success("Sale created successfully");

      scheduleBackgroundTask(
        async () => {
          const invoiceData = await prepareInvoiceData(sale.id);
          if (!invoiceData) return;

          const webhookResult = await sendInvoiceWebhook(invoiceData);
          if (!webhookResult.success) {
            console.warn("Invoice webhook failed:", webhookResult.error);
          }
        },
        `sendInvoiceWebhook:${sale.id}`,
      );
    },
    onError: (error) => {
      toast.error("Failed to create sale: " + getStockFailureMessage(error));
    },
  });

  const updateSale = useMutation({
    mutationFn: async (saleData: UpdateSaleData) => {
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      const { items, id, payment_splits, ...saleInfo } = saleData;
      const normalizedAmountPaid = saleInfo.amount_paid ?? 0;
      const paymentSplits = normalizePaymentSplits(
        payment_splits,
        saleInfo.payment_method,
        normalizedAmountPaid
      );

      // Fetch previous sale status and invoice number before updating
      const { data: prevSale, error: prevSaleError } = await supabase
        .from("sales")
        .select("payment_status, courier_status, invoice_number")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();
      if (prevSaleError) throw prevSaleError;
      const prevStatus = prevSale?.payment_status as string | undefined;
      const prevCourierStatus = prevSale?.courier_status as string | undefined;

      // Update sale record
      let saleResult = await supabase
        .from("sales")
        .update(saleInfo)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .maybeSingle();

      if (saleResult.error && isMissingSalesCreditTermsSchemaError(saleResult.error)) {
        salesCreditTermsSchemaMissing = true;
        saleResult = await supabase
          .from("sales")
          .update(stripSalesCreditTermFields(saleInfo as Record<string, unknown>))
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select()
          .maybeSingle();
      }

      if (saleResult.error) throw saleResult.error;
      const sale = saleResult.data;
      if (!sale) {
        throw new Error("Sale update was rejected by database access rules or tenant mismatch.");
      }

      // Get existing sale items
      const { data: existingItems, error: existingError } = await supabase
        .from("sales_items")
        .select("id, product_id, variant_id, quantity, rate, sale_price")
        .eq("sale_id", id)
        .eq("tenant_id", tenantId);

      if (existingError) throw existingError;

      const normalizedExisting = (existingItems || []).map((item) => {
        const effectiveRate =
          item.sale_price !== null && item.sale_price !== undefined
            ? Number(item.sale_price)
            : Number(item.rate || 0);
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: Number(item.quantity || 0),
          rate: Number.isFinite(effectiveRate) ? effectiveRate : 0,
        };
      });
      const normalizedIncoming = items.map((item) => {
        const effectiveRate =
          item.sale_price !== null && item.sale_price !== undefined
            ? Number(item.sale_price)
            : Number(item.rate || 0);
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: Number(item.quantity || 0),
          rate: Number.isFinite(effectiveRate) ? effectiveRate : 0,
        };
      });

      const itemsEqual = (a: typeof normalizedExisting, b: typeof normalizedIncoming) => {
        if (a.length !== b.length) return false;
        const sortKey = (item: typeof normalizedExisting[number]) =>
          `${item.product_id || ""}:${item.variant_id || ""}:${item.quantity}:${item.rate}`;
        const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
        const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
        return sortedA.every((item, idx) => {
          const other = sortedB[idx];
          return (
            item.product_id === other.product_id &&
            (item.variant_id || null) === (other.variant_id || null) &&
            item.quantity === other.quantity &&
            item.rate === other.rate
          );
        });
      };

      const shouldSkipItemUpdate = itemsEqual(normalizedExisting, normalizedIncoming);

      if (!shouldSkipItemUpdate) {
        // Delete existing sale items
        const { error: deleteError } = await supabase
          .from("sales_items")
          .delete()
          .eq("sale_id", id)
          .eq("tenant_id", tenantId);

        if (deleteError) throw deleteError;

        // Create new sale items (preserve variant_id when present)
        const saleItems = items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_image_url: item.product_image_url ?? null,
          quantity: item.quantity,
          rate: item.rate,
          sale_price: item.sale_price ?? null,
          total: item.total,
          variant_id: item.variant_id ?? null,
          variant_image_url: item.variant_image_url ?? null,
          sale_id: id,
          tenant_id: tenantId,
        }));

        const { error: itemsError } = await supabase
          .from("sales_items")
          .insert(saleItems);

        if (itemsError) {
          const raw = String(itemsError.message || "");
          if (raw.toLowerCase().includes("insufficient stock")) {
            const details = await getInsufficientStockDetails(saleItems);
            if (details) {
              throw new Error(
                `Insufficient stock for ${details.name}. Left in stock: ${details.stock}.`
              );
            }
          }
          throw itemsError;
        }
      }

      const { error: deleteSplitsError } = await supabase
        .from("sale_payments")
        .delete()
        .eq("sale_id", id)
        .eq("tenant_id", tenantId);

      if (deleteSplitsError) throw deleteSplitsError;

      if (paymentSplits.length > 0) {
        const splitRows = paymentSplits.map((split) => ({
          sale_id: id,
          method: split.method,
          amount: split.amount,
          tenant_id: tenantId,
        }));
        const { error: splitError } = await supabase
          .from("sale_payments")
          .insert(splitRows);
        if (splitError) throw splitError;
      }

      const newPaymentStatus = (saleInfo.payment_status ?? sale.payment_status) as string | undefined;
      const newCourierStatus = (saleInfo.courier_status ?? sale.courier_status) as string | undefined;
      const wasCancelled = isCancelledStatus(prevStatus, prevCourierStatus);
      const isNowCancelled = isCancelledStatus(newPaymentStatus, newCourierStatus);

      // Restore stock when transitioning to cancelled/returned (not lost — product is gone)
      const isNowLost = newCourierStatus === "lost";
      if (!wasCancelled && isNowCancelled && !isNowLost) {
        try {
          // Check if inventory was already restored (by DB trigger or previous attempt)
          const { data: currentSale } = await supabase
            .from("sales")
            .select("inventory_restored")
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .single();

          if (!currentSale?.inventory_restored) {
            // Get sale items to restore stock
            const { data: saleItemsToRestore } = await supabase
              .from("sales_items")
              .select("product_id, variant_id, quantity")
              .eq("sale_id", id)
              .eq("tenant_id", tenantId);

            if (saleItemsToRestore && saleItemsToRestore.length > 0) {
              for (const item of saleItemsToRestore) {
                // Restore product stock
                const { data: currentProduct } = await supabase
                  .from("products")
                  .select("stock_quantity")
                  .eq("id", item.product_id)
                  .eq("tenant_id", tenantId)
                  .single();

                if (currentProduct) {
                  await supabase
                    .from("products")
                    .update({ stock_quantity: (currentProduct.stock_quantity || 0) + item.quantity })
                    .eq("id", item.product_id)
                    .eq("tenant_id", tenantId);
                }

                // Restore variant stock if applicable
                if (item.variant_id) {
                  const { data: currentVariant } = await supabase
                    .from("product_variants")
                    .select("stock_quantity")
                    .eq("id", item.variant_id)
                    .eq("tenant_id", tenantId)
                    .single();

                  if (currentVariant) {
                    await supabase
                      .from("product_variants")
                      .update({ stock_quantity: (currentVariant.stock_quantity || 0) + item.quantity })
                      .eq("id", item.variant_id)
                      .eq("tenant_id", tenantId);
                  }
                }
              }

              // Mark as restored to prevent double restoration
              await supabase
                .from("sales")
                .update({ inventory_restored: true })
                .eq("id", id)
                .eq("tenant_id", tenantId);
            }
          }
        } catch (restoreError) {
          console.error("Error restoring inventory for cancelled sale:", restoreError);
        }
      }

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: salesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      // Update customer status automatically
      if (sale.customer_id) {
        updateCustomerStatus(sale.customer_id);
      }

      toast.success("Sale updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update sale: " + getStockFailureMessage(error));
    },
  });

  const getSaleWithItems = async (saleId: string) => {
    try {
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout')), 8000)
      );

      let hasCourierName = true;
      let hasTrackingCode = true;
      let hasCreditTerms = !salesCreditTermsSchemaMissing;
      let salePromise = supabase
        .from("sales")
        .select(
          buildSaleDetailsSelect({
            includeCourierName: hasCourierName,
            includeTrackingNumber: hasTrackingCode,
            includeCreditTerms: hasCreditTerms,
          }),
        )
        .eq("id", saleId)
        .eq("tenant_id", tenantId)
        .single();

      let { data: sale, error: saleError } = await Promise.race([salePromise, timeoutPromise]) as any;

      if (saleError) {
        const msg = String(saleError.message || "");
        const missingCourier = msg.includes("courier_name");
        const missingTracking = msg.includes("tracking_number");
        const missingCreditTerms = isMissingSalesCreditTermsSchemaError(saleError);

        if (missingCreditTerms) {
          hasCreditTerms = false;
          salesCreditTermsSchemaMissing = true;
        }
        if (missingTracking) {
          hasTrackingCode = false;
        }
        if (missingCourier) {
          hasCourierName = false;
        }

        if (missingCourier || missingTracking || missingCreditTerms) {
          salePromise = supabase
            .from("sales")
            .select(
              buildSaleDetailsSelect({
                includeCourierName: hasCourierName,
                includeTrackingNumber: hasTrackingCode,
                includeCreditTerms: hasCreditTerms,
              }),
            )
            .eq("id", saleId)
            .eq("tenant_id", tenantId)
            .single();
          const retry = await Promise.race([salePromise, timeoutPromise]) as any;
          sale = retry.data;
          saleError = retry.error;
        }

        if (!saleError && sale) {
          if (!hasCourierName) {
            sale.courier_name = null;
          }
          if (!hasTrackingCode) {
            (sale as any).tracking_number = null;
          }
          if (!hasCreditTerms) {
            sale.payment_terms = "immediate";
            sale.credit_days = null;
            sale.due_date = null;
          }
        }
      }

      if (saleError) {
        console.error("Error fetching sale:", saleError);
        throw saleError;
      }

      // Always refresh customer details dynamically for invoice printing
      // while keeping the sale snapshot as a fallback.
      if (sale?.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("name, phone, whatsapp, address, email, additional_info, is_deleted")
          .eq("id", sale.customer_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (customerError) {
          console.warn("Error fetching customer for sale:", customerError);
        } else if (customer && !customer.is_deleted) {
          sale = {
            ...sale,
            customer_name: customer.name || sale.customer_name,
            customer_phone: customer.phone || sale.customer_phone,
            customer_whatsapp: customer.whatsapp || sale.customer_whatsapp,
            customer_address: customer.address || sale.customer_address,
            customer_email: customer.email || sale.customer_email,
            additional_info: customer.additional_info || sale.additional_info,
          };
        }
      }

      const itemsPromise = supabase
        .from("sales_items")
        .select(`
          *,
          product_variants!sales_items_variant_id_fkey(attributes, image_url),
          products!sales_items_product_id_fkey(image_url, name)
        `)
        .eq("sale_id", saleId)
        .eq("tenant_id", tenantId);

      const { data: items, error: itemsError } = await Promise.race([itemsPromise, timeoutPromise]) as any;

      if (itemsError) throw itemsError;

      const itemsWithVariants = (items || []).map(item => {
        const rawVariantAttrs =
          (item as any).product_variants?.attributes ??
          (item as any).attributes ??
          null;

        // Imported data sometimes stores attributes as JSON strings.
        // Parse safely and only replace the raw value when parsing yields real keys.
        const parsedVariantAttrs = parseVariantAttributes(rawVariantAttrs);
        const hasParsedAttrs = Object.keys(parsedVariantAttrs).length > 0;
        const variantAttrs = hasParsedAttrs ? parsedVariantAttrs : rawVariantAttrs;

        const variantLabel = (() => {
          if (hasParsedAttrs) {
            return Object.values(parsedVariantAttrs).filter(Boolean).join(" / ");
          }
          if (!variantAttrs) return null;
          if (typeof variantAttrs === "string") return variantAttrs;
          if (Array.isArray(variantAttrs)) return variantAttrs.filter(Boolean).join(" / ");
          if (typeof variantAttrs === "object") return Object.values(variantAttrs).filter(Boolean).join(" / ");
          return null;
        })();

        const descriptionForPrint = variantLabel
          ? `${item.product_name} * ${variantLabel}`
          : item.product_name;

        return {
          ...item,
          variant_attributes: variantAttrs,
          variant_label: variantLabel,
          description_for_print: descriptionForPrint,
          product_image_url: (item as any).product_image_url || (item as any).products?.image_url || null,
          variant_image_url: (item as any).variant_image_url || (item as any).product_variants?.image_url || null
        };
      });

      const { data: paymentSplits, error: paymentSplitsError } = await supabase
        .from("sale_payments")
        .select("method, amount")
        .eq("sale_id", saleId)
        .eq("tenant_id", tenantId);

      if (paymentSplitsError) {
        console.warn("Error fetching sale payment splits:", paymentSplitsError);
      }

      // Return both 'items' (for dialogs) and 'sale_items' (for invoice template)
      return {
        ...sale,
        items: itemsWithVariants,
        sale_items: itemsWithVariants,
        payment_splits: paymentSplits || [],
      };
    } catch (error) {
      console.error("Error in getSaleWithItems:", error);
      throw error;
    }
  };

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission('sales.delete')) {
        throw new Error("You don't have permission to delete sales");
      }
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      const { error } = await supabase
        .from("sales")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Error soft deleting sale:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Sale moved to trash");
    },
    onError: (error) => {
      toast.error("Failed to delete sale: " + error.message);
    },
  });

  const restoreSale = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission('sales.delete')) {
        throw new Error("You don't have permission to restore sales");
      }
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      const { error } = await supabase
        .from("sales")
        .update({
          is_deleted: false,
          deleted_at: null,
        })
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["trash", "sales"], (prev: any) =>
        Array.isArray(prev) ? prev.filter((item) => item?.id !== id) : prev
      );
      queryClient.invalidateQueries({ queryKey: salesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trash", "sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Sale restored");
    },
    onError: (error) => {
      toast.error("Failed to restore sale: " + error.message);
    },
  });

  const hardDeleteSale = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission('sales.delete')) {
        throw new Error("You don't have permission to delete sales");
      }
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      const { error: salesItemsError } = await supabase
        .from("sales_items")
        .delete()
        .eq("sale_id", id)
        .eq("tenant_id", tenantId);

      if (salesItemsError) {
        console.error("Error deleting sales_items:", salesItemsError);
        throw new Error("Failed to delete associated sales_items: " + salesItemsError.message);
      }

      const { error: saleItemsError } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", id)
        .eq("tenant_id", tenantId);

      if (saleItemsError) {
        console.warn("Error deleting sale_items (may not exist):", saleItemsError);
      }

      const { error: paymentsError } = await supabase
        .from("sale_payments")
        .delete()
        .eq("sale_id", id)
        .eq("tenant_id", tenantId);

      if (paymentsError) {
        console.warn("Error deleting sale_payments:", paymentsError);
      }

      const { data: deletedSales, error } = await supabase
        .from("sales")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("id");

      if (error) {
        console.error("Error deleting sale:", error);
        throw error;
      }
      if (!deletedSales || deletedSales.length === 0) {
        throw new Error("Sale not deleted (not found or blocked by RLS)");
      }
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["trash", "sales"], (prev: any) =>
        Array.isArray(prev) ? prev.filter((item) => item?.id !== id) : prev
      );
      queryClient.invalidateQueries({ queryKey: salesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trash", "sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Sale permanently deleted");
    },
    onError: (error) => {
      toast.error("Failed to permanently delete sale: " + error.message);
    },
  });

  return {
    sales,
    isLoading,
    error,
    refetch,
    createSale,
    updateSale,
    deleteSale,
    restoreSale,
    hardDeleteSale,
    getSaleWithItems,
    supportsPackaged: !salesSchemaCompatibilityBlocked,
  };
};
