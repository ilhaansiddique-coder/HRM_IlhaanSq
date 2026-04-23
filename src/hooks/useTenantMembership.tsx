import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { syncTenantCookie } from "@/lib/authBridge";

export const useTenantMembership = () => {
  const { user } = useAuth();

  const {
    data: tenantId,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["current-tenant-id", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("current_tenant_id");
      if (error) {
        const metadataTenantId =
          (user?.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
          (user?.user_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
          null;
        return metadataTenantId;
      }
      return (data as string | null) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    retry: false,
  });

  useEffect(() => {
    if (!user) {
      syncTenantCookie(null);
      return;
    }

    if (!isLoading) {
      syncTenantCookie(tenantId ?? null);
    }
  }, [isLoading, tenantId, user]);

  return {
    tenantId: tenantId ?? null,
    hasTenant: Boolean(tenantId),
    isLoading,
    error,
  };
};
