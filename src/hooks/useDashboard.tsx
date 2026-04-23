import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { toZonedDate } from "@/lib/time";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useTenantMembership } from "./useTenantMembership";
import { useEffect } from "react";
import { isCreditSaleRecord } from "@/lib/salePaymentState";
import {
  getSaleNetAmount,
  getSaleNetPaid,
  getSaleRevenueContribution,
  isSaleCountableInUnitsSold,
  isSaleExcludedFromCustomerDue,
  isSaleValidForRevenue,
  normalizeCourierStatus,
} from "@/lib/businessRules";

export interface DashboardStats {
  totalRevenue: number;
  totalPaid: number;
  totalDue: number;
  codDue: number;
  creditDue: number;
  unitsSold: number;
  totalProducts: number;
  activeCustomers: number;
  totalOrders: number;
  todayRevenue: number;
  todayOrders: number;
  thisWeekRevenue: number;
  thisMonthRevenue: number;
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    stock_quantity: number;
  }>;
  outOfStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
  }>;
  pendingPayments: Array<{
    id: string;
    customer_name: string;
    invoice_number: string;
    amount_due: number;
    created_at: string;
  }>;
  recentSales: Array<{
    id: string;
    invoice_number: string;
    customer_name: string;
    grand_total: number;
    payment_status: string;
    created_at: string;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    quantity_sold: number;
    revenue: number;
  }>;
}

type DashboardQueryError = { code?: string; message?: string } | null;

type DashboardSaleRecord = {
  id: string;
  invoice_number: string;
  customer_name: string;
  grand_total: number | null;
  amount_paid: number | null;
  amount_due: number | null;
  fee: number | null;
  payment_status: string | null;
  courier_status: string | null;
  payment_terms?: "immediate" | "cod" | "credit" | null;
  created_at: string;
};

type DashboardSaleItemRecord = {
  sale_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  rate: number | null;
  sale_price: number | null;
};

const DASHBOARD_BATCH_SIZE = 100;

const createEmptyDashboardStats = (): DashboardStats => ({
  totalRevenue: 0,
  totalPaid: 0,
  totalDue: 0,
  codDue: 0,
  creditDue: 0,
  unitsSold: 0,
  totalProducts: 0,
  activeCustomers: 0,
  totalOrders: 0,
  todayRevenue: 0,
  todayOrders: 0,
  thisWeekRevenue: 0,
  thisMonthRevenue: 0,
  lowStockProducts: [],
  outOfStockProducts: [],
  pendingPayments: [],
  recentSales: [],
  topProducts: [],
});

const isSchemaCompatibilityError = (queryError: DashboardQueryError) => {
  if (!queryError) return false;
  const message = String(queryError.message || "").toLowerCase();
  return (
    queryError.code === "42703" ||
    queryError.code === "PGRST100" ||
    queryError.code === "PGRST204" ||
    queryError.code === "22P02" ||
    String(queryError.code || "").toUpperCase().startsWith("PGRST") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("relationship") ||
    message.includes("schema cache") ||
    message.includes("parse")
  );
};

export const useDashboard = (startDate?: Date, endDate?: Date) => {
  const { systemSettings } = useSystemSettings();
  const { user } = useAuth();
  const { tenantId, isLoading: isTenantMembershipLoading } = useTenantMembership();
  const queryClient = useQueryClient();
  const getActualPaid = (sale: { amount_paid?: number | null; grand_total?: number | null }) =>
    Math.max(0, (sale.amount_paid ?? 0) || (sale.grand_total || 0));

  const dateFilter = startDate && endDate ? {
    // startDate/endDate are already normalized to the system timezone by the date filter
    start: startOfDay(startDate).toISOString(),
    end: endOfDay(endDate).toISOString()
  } : null;

  const {
    data: dashboardStats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard", tenantId, dateFilter, systemSettings.timezone],
    queryFn: async () => {
      const stats = createEmptyDashboardStats();

      const now = toZonedDate(new Date(), systemSettings.timezone);
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);

      const fetchSales = async (period?: { start: string; end: string }) => {
        let baseQuery = supabase
          .from("sales")
          .select("*")
          .neq("payment_status", "cancelled");

        if (period) {
          baseQuery = baseQuery.gte("created_at", period.start).lte("created_at", period.end);
        }
        if (tenantId) {
          baseQuery = baseQuery.eq("tenant_id", tenantId);
        }

        let result = await baseQuery.eq("is_deleted", false);
        if (result.error && isSchemaCompatibilityError(result.error)) {
          result = await baseQuery;
        }
        if (result.error) throw result.error;
        return (result.data || []) as DashboardSaleRecord[];
      };

      const fetchSalesItemsBySaleIds = async (saleIds: string[]) => {
        if (!saleIds.length) {
          return [] as DashboardSaleItemRecord[];
        }

        const saleItems: DashboardSaleItemRecord[] = [];
        for (let index = 0; index < saleIds.length; index += DASHBOARD_BATCH_SIZE) {
          const batch = saleIds.slice(index, index + DASHBOARD_BATCH_SIZE);
          let salesItemsQuery = supabase
            .from("sales_items")
            .select("sale_id, product_id, product_name, quantity, rate, sale_price")
            .in("sale_id", batch);

          if (tenantId) {
            salesItemsQuery = salesItemsQuery.eq("tenant_id", tenantId);
          }

          const { data, error } = await salesItemsQuery;
          if (error) {
            if (isSchemaCompatibilityError(error)) {
              console.warn("Skipping dashboard sales_items aggregation due to schema compatibility issue.", error);
              return [] as DashboardSaleItemRecord[];
            }
            throw error;
          }

          saleItems.push(...((data || []) as DashboardSaleItemRecord[]));
        }

        return saleItems;
      };

      const [sales, weekSales, monthSales, todaySales] = await Promise.all([
        fetchSales(dateFilter || undefined),
        fetchSales({ start: weekStart.toISOString(), end: todayEnd.toISOString() }),
        fetchSales({ start: monthStart.toISOString(), end: todayEnd.toISOString() }),
        fetchSales({ start: todayStart.toISOString(), end: todayEnd.toISOString() }),
      ]);

      if (sales.length > 0) {
        const revenueSales = sales.filter(isSaleValidForRevenue);
        stats.totalRevenue = revenueSales.reduce((sum, sale) => sum + getSaleRevenueContribution(sale), 0);
        stats.totalOrders = sales.length;

        // Calculate paid amount for due (net of fees, based on payment status or delivered)
        const totalPaidForDue = revenueSales.reduce((sum, sale) => {
          const isCreditSale = isCreditSaleRecord(sale);
          const isPaidInFull = isCreditSale
            ? sale.payment_status === 'paid' && Math.max(0, sale.amount_due || 0) === 0
            : sale.payment_status === 'paid' || sale.courier_status === 'delivered';
          return isPaidInFull ? sum + getSaleNetAmount(sale) : sum + getSaleNetPaid(sale);
        }, 0);

        // Calculate paid amount for display (use actual paid amounts, no fee deduction)
        stats.totalPaid = revenueSales.reduce((sum, sale) => {
          const isCreditSale = isCreditSaleRecord(sale);
          const isPaidInFull = isCreditSale
            ? sale.payment_status === 'paid' && Math.max(0, sale.amount_due || 0) === 0
            : sale.payment_status === 'paid' || sale.courier_status === 'delivered';
          const paidAmount = sale.amount_paid ?? 0;
          const paidTotal = paidAmount > 0 ? paidAmount : (isPaidInFull ? getActualPaid(sale) : 0);
          return sum + paidTotal;
        }, 0);

        // Calculate due amount (total revenue - net paid amount)
        stats.totalDue = Math.max(0, stats.totalRevenue - totalPaidForDue);

        // Calculate COD due (pending COD orders not yet delivered)
        stats.codDue = sales.reduce((sum, sale) => {
          if (isSaleExcludedFromCustomerDue(sale)) {
            return sum;
          }
          const paymentTerms = sale.payment_terms || "immediate";
          if (paymentTerms === 'cod' && normalizeCourierStatus(sale.courier_status) !== 'delivered') {
            const netTotal = getSaleNetAmount(sale);
            const due = Math.max(0, netTotal - getSaleNetPaid(sale));
            return sum + due;
          }
          return sum;
        }, 0);

        // Calculate Credit due (all credit sales with outstanding balance)
        stats.creditDue = sales.reduce((sum, sale) => {
          if (isSaleExcludedFromCustomerDue(sale)) {
            return sum;
          }
          const paymentTerms = sale.payment_terms || "immediate";
          if (paymentTerms === 'credit') {
            const netTotal = getSaleNetAmount(sale);
            const due = Math.max(0, netTotal - getSaleNetPaid(sale));
            return sum + due;
          }
          return sum;
        }, 0);

      }

      stats.todayRevenue = todaySales.reduce((sum, sale) => sum + getSaleRevenueContribution(sale), 0);
      stats.todayOrders = todaySales.length;
      stats.thisWeekRevenue = weekSales.reduce((sum, sale) => sum + getSaleRevenueContribution(sale), 0);
      stats.thisMonthRevenue = monthSales.reduce((sum, sale) => sum + getSaleRevenueContribution(sale), 0);
      stats.recentSales = [...sales]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((sale) => ({
          id: sale.id,
          invoice_number: sale.invoice_number,
          customer_name: sale.customer_name,
          grand_total: sale.grand_total || 0,
          payment_status: sale.payment_status || "pending",
          created_at: sale.created_at,
        }));

      const selectedSaleIds = sales
        .map((sale) => sale.id)
        .filter((saleId): saleId is string => Boolean(saleId));
      const salesItems = await fetchSalesItemsBySaleIds(selectedSaleIds);

      if (salesItems.length > 0) {
        const countableSaleIds = new Set(
          sales
            .filter(isSaleCountableInUnitsSold)
            .map((sale) => sale.id)
            .filter((saleId): saleId is string => Boolean(saleId)),
        );
        const countableSalesItems = salesItems.filter((item) => countableSaleIds.has(item.sale_id));

        stats.unitsSold = countableSalesItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
        countableSalesItems.forEach((item) => {
          const productId = item.product_id || item.product_name || item.sale_id;
          const quantity = item.quantity || 0;
          const unitPrice = item.sale_price ?? item.rate ?? 0;
          const revenue = quantity * unitPrice;

          if (productMap.has(productId)) {
            const existing = productMap.get(productId)!;
            existing.quantity += quantity;
            existing.revenue += revenue;
            return;
          }

          productMap.set(productId, {
            name: item.product_name || "Unknown",
            quantity,
            revenue,
          });
        });

        stats.topProducts = Array.from(productMap.entries())
          .map(([id, data]) => ({
            id,
            name: data.name,
            quantity_sold: data.quantity,
            revenue: data.revenue,
          }))
          .sort((a, b) => b.quantity_sold - a.quantity_sold)
          .slice(0, 5);
      }

      // Get business settings for low stock threshold
      let businessSettingsQuery = supabase
        .from("business_settings")
        .select("low_stock_alert_quantity")
        .limit(1);
      if (tenantId) {
        businessSettingsQuery = businessSettingsQuery.eq("tenant_id", tenantId);
      }
      const { data: businessSettings } = await businessSettingsQuery.maybeSingle();

      const globalLowStockThreshold = businessSettings?.low_stock_alert_quantity || 12;

      // Get total products
      let productsQuery = supabase
        .from("products")
        .select("*");
      if (tenantId) {
        productsQuery = productsQuery.eq("tenant_id", tenantId);
      }
      let productsResult = await productsQuery.eq("is_deleted", false);
      if (productsResult.error && isSchemaCompatibilityError(productsResult.error)) {
        productsResult = await productsQuery;
      }
      if (productsResult.error) throw productsResult.error;
      const products = productsResult.data;

      let customersQuery = supabase
        .from("customers")
        .select("id", { count: "exact", head: true });
      if (tenantId) {
        customersQuery = customersQuery.eq("tenant_id", tenantId);
      }
      let customersResult = await customersQuery.eq("is_deleted", false);
      if (customersResult.error && isSchemaCompatibilityError(customersResult.error)) {
        customersResult = await customersQuery;
      }
      if (customersResult.error) throw customersResult.error;
      stats.activeCustomers = customersResult.count ?? 0;

      if (products) {
        stats.totalProducts = products.length;

        // Get low stock products
        stats.lowStockProducts = products
          .filter(product => {
            const stockQty = product.stock_quantity || 0;
            const threshold = product.low_stock_threshold ?? globalLowStockThreshold;
            return stockQty > 0 && stockQty <= threshold && !product.has_variants;
          })
          .slice(0, 5)
          .map(product => ({
            id: product.id,
            name: product.name,
            sku: product.sku || '',
            stock_quantity: product.stock_quantity,
          }));

        // Get out of stock products
        stats.outOfStockProducts = products
          .filter(product => {
            const stockQty = product.stock_quantity || 0;
            return stockQty === 0 && !product.has_variants;
          })
          .slice(0, 5)
          .map(product => ({
            id: product.id,
            name: product.name,
            sku: product.sku || '',
          }));
      }

      // Get pending payments (exclude cancelled sales)
      let pendingSalesQuery = supabase
        .from("sales")
        .select("*")
        .in("payment_status", ["pending", "partial"])
        .gt("amount_due", 0)
        .order("created_at", { ascending: false })
        .limit(5);
      if (tenantId) {
        pendingSalesQuery = pendingSalesQuery.eq("tenant_id", tenantId);
      }
      let pendingSalesResult = await pendingSalesQuery.eq("is_deleted", false);
      if (pendingSalesResult.error && isSchemaCompatibilityError(pendingSalesResult.error)) {
        pendingSalesResult = await pendingSalesQuery;
      }

      if (pendingSalesResult.error) {
        console.warn("Skipping dashboard pending payments due to query error.", pendingSalesResult.error);
      } else if (pendingSalesResult.data) {
        stats.pendingPayments = pendingSalesResult.data
          .filter(
            (sale) =>
              !isSaleExcludedFromCustomerDue(sale) &&
              (isCreditSaleRecord(sale) || normalizeCourierStatus(sale.courier_status) !== "delivered"),
          )
          .map(sale => ({
            id: sale.id,
            customer_name: sale.customer_name,
            invoice_number: sale.invoice_number,
            amount_due: sale.amount_due || 0,
            created_at: sale.created_at,
          }));
      }

      return stats;
    },
    enabled: !!user && !isTenantMembershipLoading,
    retry: false,
  });

  useEffect(() => {
    if (!user || isTenantMembershipLoading) return;
    const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const channel = supabase
      .channel(`dashboard-realtime-${tenantId ?? "global"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", ...(filter ? { filter } : {}) },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_items", ...(filter ? { filter } : {}) },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers", ...(filter ? { filter } : {}) },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", ...(filter ? { filter } : {}) },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isTenantMembershipLoading, queryClient, tenantId, user]);

  return {
    dashboardStats,
    isLoading,
    error,
  };
};
