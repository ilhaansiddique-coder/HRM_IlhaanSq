import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerCredit = (customerId?: string) => {
    return useQuery({
        queryKey: ["customer-credit", customerId],
        queryFn: async () => {
            if (!customerId) return null;

            // Get customer credit limit
            const { data: customer } = await supabase
                .from("customers")
                .select("credit_limit")
                .eq("id", customerId)
                .single();

            // Get all credit sales for this customer
            const creditSalesResult = await supabase
                .from("sales")
                .select("*")
                .eq("customer_id", customerId);

            if (creditSalesResult.error) {
                return {
                    creditLimit: customer?.credit_limit || 0,
                    creditUsed: 0,
                    creditAvailable: customer?.credit_limit || 0,
                    utilizationPercent: 0,
                };
            }

            const creditSales = (creditSalesResult.data || []).filter((sale) => {
                const paymentTerms = String((sale as { payment_terms?: string | null }).payment_terms || "").toLowerCase();
                const courierStatus = String((sale as { courier_status?: string | null }).courier_status || "").toLowerCase();
                if (courierStatus === "cancelled" || courierStatus === "returned" || courierStatus === "lost") {
                    return false;
                }
                return paymentTerms ? paymentTerms === "credit" : true;
            });

            const creditUsed = (creditSales || []).reduce((sum, sale) => {
                const netTotal = (sale.grand_total || 0) - (sale.fee || 0);
                const due = Math.max(0, netTotal - (sale.amount_paid || 0));
                return sum + due;
            }, 0);

            const creditLimit = customer?.credit_limit || 0;
            const creditAvailable = Math.max(0, creditLimit - creditUsed);

            return {
                creditLimit,
                creditUsed,
                creditAvailable,
                utilizationPercent: creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0,
            };
        },
        enabled: !!customerId,
        retry: false,
    });
};
