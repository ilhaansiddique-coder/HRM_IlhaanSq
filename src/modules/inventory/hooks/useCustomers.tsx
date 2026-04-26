import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantMembership } from "@/hooks/useTenantMembership";
import { useUserRole } from "@/hooks/useUserRole";
import { upsertCustomerWithServerAccess } from "@/modules/inventory/services/customersService";
import { toast } from "@/utils/toast";
import { useEffect } from "react";

let customersSchemaCompatibilityBlocked = false;
const customerSoftDeleteColumnSupport: {
  is_deleted: boolean;
  deleted_at: boolean;
} = {
  is_deleted: true,
  deleted_at: true,
};

const isSchemaCompatibilityError = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST100" ||
    error.code === "PGRST204" ||
    error.code === "22P02" ||
    String(error.code || "").toUpperCase().startsWith("PGRST") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("parse")
  );
};

const extractMissingColumnName = (error: { code?: string; message?: string } | null) => {
  if (!error) return null;

  const message = String(error.message || "");
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const missingColumnMatch = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+does not exist/i);
  return missingColumnMatch?.[1] ?? null;
};

const getCustomerSoftDeleteUnsupportedMessage = () =>
  "Customer trash is unavailable because the database is missing the customer soft-delete columns. Apply the customer soft-delete migration first.";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  tags: string[];
  order_count: number;
  delivered_count: number;
  cancelled_count: number;
  total_spent: number;
  status: string;
  additional_info: string | null;
  credit_limit?: number | null;
  credit_due?: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
}

export interface CreateCustomerData {
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  tags?: string[];
  status?: string;
  additional_info?: string;
  credit_limit?: number;
}

export const useCustomers = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const { hasPermission } = useUserRole();
  const queryClient = useQueryClient();
  const customersQueryKey = ["customers", tenantId];

  // Set up real-time subscriptions for customers and sales
  useEffect(() => {
    if (!user || !tenantId) return;

    const invalidateCustomers = () => {
      queryClient.invalidateQueries({ queryKey: ["customers", tenantId] });
    };

    const customersChannel = supabase
      .channel(`customers-changes-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `tenant_id=eq.${tenantId}`,
        },
        invalidateCustomers
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `tenant_id=eq.${tenantId}`,
        },
        invalidateCustomers
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customersChannel);
    };
  }, [user, tenantId, queryClient]);

  const {
    data: customers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: customersQueryKey,
    queryFn: async () => {
      if (customersSchemaCompatibilityBlocked) {
        return [] as Customer[];
      }
      if (!tenantId) {
        return [] as Customer[];
      }

      const customersResult = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (customersResult.error) {
        if (isSchemaCompatibilityError(customersResult.error)) {
          customersSchemaCompatibilityBlocked = true;
          return [] as Customer[];
        }
        throw customersResult.error;
      }
      const customersData = (customersResult.data as Customer[]).filter(
        (customer) => customer.is_deleted !== true,
      );

      // Dynamically compute customer stats from sales to ensure up-to-date values
      // Batch the .in() query to avoid exceeding Supabase URL length limits
      const customerIds = (customersData || []).map((c) => c.id);
      const BATCH_SIZE = 100;
      const SALES_BASE_SELECT =
        "customer_id, grand_total, fee, created_at, payment_status, courier_status, amount_paid, amount_due, review_amount_paid, review_amount_due, payment_terms, payment_method, is_deleted, id";
      const SALES_SELECT_WITH_SPLITS = `${SALES_BASE_SELECT}, sale_payments(method, amount)`;
      let salesData: Array<{
        customer_id: string | null;
        grand_total: number | null;
        amount_due: number | null;
        review_amount_due: number | null;
        amount_paid: number | null;
        review_amount_paid: number | null;
        fee: number | null;
        created_at: string;
        payment_status: string | null;
        courier_status: string | null;
        payment_terms: string | null;
        payment_method: string | null;
        sale_payments: Array<{ method: string | null; amount: number | null }>;
      }> = [];
      let supportsSalePaymentsJoin = true;
      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);
        let salesResult = await supabase
          .from("sales")
          .select(supportsSalePaymentsJoin ? SALES_SELECT_WITH_SPLITS : SALES_BASE_SELECT)
          .eq("tenant_id", tenantId)
          .in("customer_id", batch);
        if (salesResult.error && supportsSalePaymentsJoin && isSchemaCompatibilityError(salesResult.error)) {
          // Postgrest can't see sale_payments — drop the join for the rest of the loop.
          supportsSalePaymentsJoin = false;
          salesResult = await supabase
            .from("sales")
            .select(SALES_BASE_SELECT)
            .eq("tenant_id", tenantId)
            .in("customer_id", batch);
        }
        if (salesResult.error) {
          if (isSchemaCompatibilityError(salesResult.error)) {
            continue;
          }
          throw salesResult.error;
        }
        if (salesResult.data) {
          const mapped = (salesResult.data as Array<Record<string, unknown>>)
            .filter((sale) => sale.is_deleted !== true)
            .map((sale) => ({
              customer_id: (sale.customer_id as string | null) ?? null,
              grand_total: (sale.grand_total as number | null) ?? 0,
              amount_due: (sale.amount_due as number | null) ?? 0,
              review_amount_due: (sale.review_amount_due as number | null) ?? null,
              amount_paid: (sale.amount_paid as number | null) ?? 0,
              review_amount_paid: (sale.review_amount_paid as number | null) ?? null,
              fee: (sale.fee as number | null) ?? 0,
              created_at: String(sale.created_at ?? ""),
              payment_status: (sale.payment_status as string | null) ?? null,
              courier_status: (sale.courier_status as string | null) ?? null,
              payment_terms: (sale.payment_terms as string | null) ?? null,
              payment_method: (sale.payment_method as string | null) ?? null,
              sale_payments: Array.isArray(sale.sale_payments)
                ? (sale.sale_payments as Array<{ method?: string | null; amount?: number | null }>).map((split) => ({
                    method: split?.method ?? null,
                    amount: typeof split?.amount === "number" ? split.amount : Number(split?.amount) || 0,
                  }))
                : [],
            }));
          salesData = salesData.concat(mapped);
        }
      }

      const customerIdToStats: Record<string, {
        orderCount: number;
        deliveredCount: number;
        cancelledCount: number;
        totalSpent: number;
        creditDue: number;
        lastPurchaseDate: string | null;
      }> = {};

      (salesData || []).forEach((sale) => {
        const key = sale.customer_id as string;
        if (!customerIdToStats[key]) {
          customerIdToStats[key] = {
            orderCount: 0,
            deliveredCount: 0,
            cancelledCount: 0,
            totalSpent: 0,
            creditDue: 0,
            lastPurchaseDate: null,
          };
        }

        const stats = customerIdToStats[key];
        stats.orderCount += 1;
        const courierStatus = String((sale as any).courier_status || "").toLowerCase();
        const isActiveCourier = !["cancelled", "returned", "lost"].includes(courierStatus);
        if (courierStatus === "delivered") {
          stats.deliveredCount += 1;
          stats.totalSpent += Math.max(0, (Number(sale.grand_total) || 0) - (Number((sale as any).fee) || 0));
          if (
            !stats.lastPurchaseDate ||
            new Date(sale.created_at) > new Date(stats.lastPurchaseDate)
          ) {
            stats.lastPurchaseDate = sale.created_at as string;
          }
        } else if (!isActiveCourier) {
          stats.cancelledCount += 1;
        }

        // Credit-due rule must mirror isCreditManagedInvoice in useCustomerPayments,
        // otherwise the wallet icon (driven by credit_due) and the dialog (driven by
        // the broader rule) disagree on which customers owe credit.
        if (isActiveCourier) {
          const paymentTerms = String((sale as any).payment_terms || "").toLowerCase();
          const paymentMethod = String((sale as any).payment_method || "").toLowerCase().trim();
          const normalizedMethod = paymentMethod === "condition" ? "cod" : paymentMethod;
          const hasCreditSplit = (sale.sale_payments || []).some((split) => {
            const splitMethodRaw = String(split.method || "").toLowerCase().trim();
            const splitMethod = splitMethodRaw === "condition" ? "cod" : splitMethodRaw;
            return splitMethod === "credit" && (Number(split.amount) || 0) > 0;
          });
          const isCreditDue = paymentTerms === "credit" || normalizedMethod === "credit" || hasCreditSplit;
          if (isCreditDue) {
            const reviewDue = sale.review_amount_due;
            const rawDue =
              reviewDue !== null && reviewDue !== undefined
                ? Number(reviewDue)
                : Number(sale.amount_due);
            const computedDue = Number(sale.grand_total || 0) - Number(sale.amount_paid || 0);
            const remainingDue = Math.max(
              0,
              Number.isFinite(rawDue) && rawDue !== 0 ? rawDue : computedDue
            );
            if (remainingDue > 0) {
              stats.creditDue += remainingDue;
            }
          }
        }
      });

      const merged = (customersData as Customer[]).map((c) => {
        const s = customerIdToStats[c.id] || {
          orderCount: 0,
          deliveredCount: 0,
          cancelledCount: 0,
          totalSpent: 0,
          creditDue: 0,
          lastPurchaseDate: null,
        };
        return {
          ...c,
          order_count: s.orderCount,
          delivered_count: s.deliveredCount,
          cancelled_count: s.cancelledCount,
          credit_due: s.creditDue,
          total_spent: s.totalSpent,
          last_purchase_date: s.lastPurchaseDate,
        } as Customer;
      });

      return merged;
    },
    enabled: !!user && !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: false,
    retryDelay: 1000,
  });

  const createCustomer = useMutation({
    mutationFn: async (customerData: CreateCustomerData) => {
      return upsertCustomerWithServerAccess({ data: { ...customerData } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersQueryKey });
      toast.success("Customer created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create customer: " + error.message);
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCustomerData> }) => {
      return upsertCustomerWithServerAccess({ id, data: { ...data } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersQueryKey });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Customer updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update customer: " + error.message);
    },
  });

  const applyCustomerSoftDelete = async (id: string, deleted: boolean) => {
    if (!tenantId) {
      throw new Error("No active tenant found");
    }

    let payload: {
      is_deleted?: boolean;
      deleted_at?: string | null;
    } = {};

    if (customerSoftDeleteColumnSupport.is_deleted) {
      payload.is_deleted = deleted;
    }

    if (customerSoftDeleteColumnSupport.deleted_at) {
      payload.deleted_at = deleted ? new Date().toISOString() : null;
    }

    while (true) {
      if (Object.keys(payload).length === 0) {
        throw new Error(getCustomerSoftDeleteUnsupportedMessage());
      }

      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (!error) {
        return;
      }

      const missingColumn = extractMissingColumnName(error);
      if (
        isSchemaCompatibilityError(error) &&
        missingColumn &&
        Object.prototype.hasOwnProperty.call(payload, missingColumn)
      ) {
        if (missingColumn === "is_deleted" || missingColumn === "deleted_at") {
          customerSoftDeleteColumnSupport[missingColumn] = false;
        }

        const nextPayload = { ...payload };
        delete nextPayload[missingColumn];
        payload = nextPayload;
        continue;
      }

      throw error;
    }
  };

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission("customers.delete")) {
        throw new Error("You don't have permission to delete customers");
      }

      try {
        await applyCustomerSoftDelete(id, true);
      } catch (error) {
        console.error("Error deleting customer:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trash", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Customer moved to trash");
    },
    onError: (error) => {
      toast.error("Failed to delete customer: " + error.message);
    },
  });

  const restoreCustomer = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission("customers.delete")) {
        throw new Error("You don't have permission to restore customers");
      }

      await applyCustomerSoftDelete(id, false);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["trash", "customers"], (prev: any) =>
        Array.isArray(prev) ? prev.filter((item) => item?.id !== id) : prev
      );
      queryClient.invalidateQueries({ queryKey: customersQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trash", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Customer restored");
    },
    onError: (error) => {
      toast.error("Failed to restore customer: " + error.message);
    },
  });

  const hardDeleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission("customers.delete")) {
        throw new Error("You don't have permission to delete customers");
      }
      if (!tenantId) {
        throw new Error("No active tenant found");
      }

      const { data: sales, error: fetchSalesError } = await supabase
        .from("sales")
        .select("id")
        .eq("customer_id", id)
        .eq("tenant_id", tenantId);

      if (fetchSalesError) {
        console.error("Error fetching associated sales:", fetchSalesError);
        throw new Error("Failed to fetch associated sales: " + fetchSalesError.message);
      }

      if (sales && sales.length > 0) {
        const saleIds = sales.map(s => s.id);
        const batchSize = 100;

        for (let i = 0; i < saleIds.length; i += batchSize) {
          const batch = saleIds.slice(i, i + batchSize);
          const { error: salesItemsError } = await supabase
            .from("sales_items")
            .delete()
            .in("sale_id", batch)
            .eq("tenant_id", tenantId);
          if (salesItemsError) {
            console.error("Error deleting sales_items batch:", salesItemsError);
            throw new Error("Failed to delete associated sales_items: " + salesItemsError.message);
          }

          const { error: saleItemsError } = await supabase
            .from("sale_items")
            .delete()
            .in("sale_id", batch)
            .eq("tenant_id", tenantId);
          if (saleItemsError) {
            console.warn("Error deleting sale_items (may not exist):", saleItemsError);
          }

          const { error: paymentsError } = await supabase
            .from("sale_payments")
            .delete()
            .in("sale_id", batch)
            .eq("tenant_id", tenantId);
          if (paymentsError) {
            console.warn("Error deleting sale_payments batch:", paymentsError);
          }
        }

        for (let i = 0; i < saleIds.length; i += batchSize) {
          const batch = saleIds.slice(i, i + batchSize);
          const { error: salesError } = await supabase
            .from("sales")
            .delete()
            .in("id", batch)
            .eq("tenant_id", tenantId)
            .select("id");
          if (salesError) {
            console.error("Error deleting sales batch:", salesError);
            throw new Error("Failed to delete associated sales: " + salesError.message);
          }
        }
      }

      const { data: deletedCustomer, error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("id");
      if (error) {
        console.error("Error deleting customer:", error);
        throw error;
      }
      if (!deletedCustomer || deletedCustomer.length === 0) {
        throw new Error("Customer not deleted (not found or blocked by RLS)");
      }
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["trash", "customers"], (prev: any) =>
        Array.isArray(prev) ? prev.filter((item) => item?.id !== id) : prev
      );
      queryClient.invalidateQueries({ queryKey: customersQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trash", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Customer permanently deleted");
    },
    onError: (error) => {
      toast.error("Failed to permanently delete customer: " + error.message);
    },
  });


  const updateCustomerStats = useMutation({
    mutationFn: async (showNotification: boolean = true) => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKey });
      await queryClient.refetchQueries({ queryKey: customersQueryKey });
      return { showNotification };
    },
    onSuccess: (_, showNotification) => {
      if (showNotification) {
        toast.success("Customer data refreshed");
      }
    },
    onError: (error) => {
      console.error("Error updating customer statistics:", error);
      toast.error("Failed to update customer statistics: " + error.message);
    },
  });

  return {
    customers,
    isLoading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    restoreCustomer,
    hardDeleteCustomer,
    updateCustomerStats: updateCustomerStats.mutate,
    isUpdatingStats: updateCustomerStats.isPending,
  };
};
