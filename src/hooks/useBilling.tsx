import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantMembership } from "@/hooks/useTenantMembership";
import { useEffect } from "react";

export type PlanKey = "free" | "starter" | "pro";
export type BillingStatus = "inactive" | "active" | "trialing" | "past_due" | "canceled" | "unpaid";

export interface TenantBilling {
  plan_key: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const normalizePlanKey = (plan?: string | null): PlanKey => {
  if (plan === "starter" || plan === "pro") return plan;
  return "free";
};

const normalizeStatus = (status?: string | null): BillingStatus => {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "canceled" || status === "unpaid") {
    return status;
  }
  return "inactive";
};

export const useBilling = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenant-billing", tenantId ?? user?.id],
    queryFn: async () => {
      let query = supabase
        .from("tenant_billing")
        .select("plan_key, status, current_period_end, cancel_at_period_end");

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TenantBilling | null;
    },
    enabled: !!user,
    staleTime: 0,
  });

  useEffect(() => {
    if (!user) return;
    const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const channel = supabase
      .channel(`tenant-billing-${tenantId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_billing",
          ...(filter ? { filter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tenant-billing", tenantId ?? user?.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, user]);

  const planKey = normalizePlanKey(data?.plan_key ?? null);
  const status = normalizeStatus(data?.status ?? null);
  const isActive = status === "active" || status === "trialing";

  return {
    billing: data,
    planKey,
    status,
    isActive,
    currentPeriodEnd: data?.current_period_end ?? null,
    cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
    isLoading,
    error,
    refetch,
  };
};
