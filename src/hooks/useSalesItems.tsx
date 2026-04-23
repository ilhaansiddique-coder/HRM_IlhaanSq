import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface SalesItemWithSale {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  rate: number;
  sale_price?: number | null;
  total: number;
  sale_id: string;
  created_at: string;
  sales: {
    created_at: string;
    customer_id: string;
  };
}

const toSalesItemWithSale = (value: unknown): SalesItemWithSale | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const sale = candidate.sales;
  const saleRecord =
    sale && typeof sale === "object" ? (sale as Record<string, unknown>) : null;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.product_id !== "string" ||
    typeof candidate.product_name !== "string" ||
    typeof candidate.quantity !== "number" ||
    typeof candidate.rate !== "number" ||
    typeof candidate.total !== "number" ||
    typeof candidate.sale_id !== "string" ||
    typeof candidate.created_at !== "string" ||
    !saleRecord ||
    typeof saleRecord.created_at !== "string" ||
    typeof saleRecord.customer_id !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    product_id: candidate.product_id,
    product_name: candidate.product_name,
    quantity: candidate.quantity,
    rate: candidate.rate,
    sale_price: typeof candidate.sale_price === "number" ? candidate.sale_price : null,
    total: candidate.total,
    sale_id: candidate.sale_id,
    created_at: candidate.created_at,
    sales: {
      created_at: saleRecord.created_at,
      customer_id: saleRecord.customer_id,
    },
  };
};

export const useSalesItems = (startDate?: Date, endDate?: Date) => {
  const { user } = useAuth();

  const {
    data: salesItems = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["salesItems", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("sales_items")
        .select(`
          *,
          sales!inner(created_at, customer_id)
        `);

      if (startDate && endDate) {
        query = query
          .gte("sales.created_at", startDate.toISOString())
          .lte("sales.created_at", endDate.toISOString());
      }
      query = query.eq("sales.is_deleted", false);

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as unknown[])
        .map((row) => toSalesItemWithSale(row))
        .filter((row): row is SalesItemWithSale => row !== null);
    },
    enabled: !!user,
  });

  return {
    salesItems,
    isLoading,
    error,
  };
};
