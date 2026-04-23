import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatInTimeZone, toZonedDate } from "@/lib/time";

export interface OverdueSale {
    id: string;
    invoice_number: string;
    customer_name: string;
    grand_total: number;
    amount_paid: number;
    amount_due: number;
    due_date: string;
    credit_days: number;
    daysOverdue: number;
}

interface OverdueSaleRow {
    id: string;
    invoice_number: string;
    customer_name: string;
    grand_total: number | null;
    amount_paid: number | null;
    amount_due: number | null;
    due_date: string;
    credit_days: number | null;
    payment_terms?: string | null;
}

export const useOverdueCredit = () => {
    const { systemSettings } = useSystemSettings();
    return useQuery({
        queryKey: ["overdue-credit", systemSettings.timezone],
        queryFn: async () => {
            const today = formatInTimeZone(new Date(), "yyyy-MM-dd", systemSettings.timezone);
            const overdueResult = await supabase
                .from("sales")
                .select("*")
                .order("created_at", { ascending: false });

            if (overdueResult.error) {
                return [] as OverdueSale[];
            }

            const overdueSales = ((overdueResult.data || []) as OverdueSaleRow[]).filter((sale: OverdueSaleRow & { courier_status?: string | null; is_deleted?: boolean | null; created_at?: string }) => {
                if (sale.is_deleted) return false;
                if (!sale.due_date) return false;
                if (Number(sale.amount_due || 0) <= 0) return false;
                const paymentTerms = String(sale.payment_terms || "").toLowerCase();
                const courierStatus = String(sale.courier_status || "").toLowerCase();
                const isClosedCourierStatus = ["cancelled", "returned", "lost"].includes(courierStatus);
                if (isClosedCourierStatus) return false;
                if (paymentTerms && paymentTerms !== "credit") return false;
                return sale.due_date < today;
            });

            const salesWithOverdue: OverdueSale[] = (overdueSales || []).map(sale => {
                const dueDate = toZonedDate(new Date(sale.due_date), systemSettings.timezone);
                const todayDate = toZonedDate(new Date(today), systemSettings.timezone);
                const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

                return {
                    id: sale.id,
                    invoice_number: sale.invoice_number,
                    customer_name: sale.customer_name,
                    grand_total: sale.grand_total || 0,
                    amount_paid: sale.amount_paid || 0,
                    amount_due: sale.amount_due || 0,
                    due_date: sale.due_date,
                    credit_days: sale.credit_days || 0,
                    daysOverdue,
                };
            });

            return salesWithOverdue;
        },
        retry: false,
    });
};
