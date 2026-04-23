import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantMembership } from "@/hooks/useTenantMembership";
import { toast } from "@/utils/toast";
import {
  getPackagingHistory,
  getPackagingQueue,
  packSale,
  unpackSale,
  type PackagingMutationResult,
} from "@/modules/inventory/services/packagingService";

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

const getPackagingSuccessMessage = (
  action: "pack" | "unpack",
  result: PackagingMutationResult,
) => {
  if (result.idempotent) {
    return action === "pack"
      ? "Sale was already marked as packed."
      : "Sale was already marked as unpacked.";
  }

  return action === "pack"
    ? "Sale marked as packed."
    : "Sale returned to unpacked state.";
};

export const usePackagingQueue = (search: string) => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: ["packaging", "queue", tenantId, search],
    queryFn: () => getPackagingQueue(search),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const packMutation = useMutation({
    mutationFn: (saleId: string) => packSale(saleId),
    onSuccess: (result) => {
      toast.success(getPackagingSuccessMessage("pack", result));
      queryClient.invalidateQueries({ queryKey: ["packaging"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to mark sale as packed."));
    },
  });

  const unpackMutation = useMutation({
    mutationFn: (saleId: string) => unpackSale(saleId),
    onSuccess: (result) => {
      toast.success(getPackagingSuccessMessage("unpack", result));
      queryClient.invalidateQueries({ queryKey: ["packaging"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to unpack sale."));
    },
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    const salesFilter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const logsFilter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;

    const channel = supabase
      .channel(`packaging-${tenantId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          ...(salesFilter ? { filter: salesFilter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["packaging"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_logs",
          ...(logsFilter ? { filter: logsFilter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["packaging"] });
          queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, user]);

  return {
    ...queueQuery,
    packMutation,
    unpackMutation,
  };
};

export const usePackagingHistory = (saleId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["packaging", "history", saleId],
    queryFn: () => getPackagingHistory(saleId as string),
    enabled: !!user && !!saleId,
    staleTime: 15 * 1000,
  });
};
