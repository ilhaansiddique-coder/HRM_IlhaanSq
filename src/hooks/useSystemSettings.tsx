import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/utils/toast";
import { getCurrencySymbol } from "@/lib/currencySymbols";
import { appLogger } from "@/utils/logger";
import { useTenantMembership } from "./useTenantMembership";
import { useEffect } from "react";

export interface SystemSettings {
  id: string;
  currency_symbol: string;
  currency_code: string;
  timezone: string;
  date_format: string;
  time_format: string;
  invoice_webhook_url?: string;
  invoice_webhook_enabled?: boolean;
  invoice_webhook_auth_token?: string;
  invoice_webhook_timeout?: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SYSTEM_SETTINGS: Omit<SystemSettings, 'id' | 'created_at' | 'updated_at'> = {
  currency_symbol: '৳',
  currency_code: 'BDT',
  timezone: 'Asia/Dhaka',
  date_format: 'dd/MM/yyyy',
  time_format: '12h'
};

export const useSystemSettings = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const queryClient = useQueryClient();

  const {
    data: systemSettings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["systemSettings", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("system_settings")
        .select("*");

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw error;
      }
      
      // Return first row if exists, otherwise default settings
      return data as SystemSettings || { ...DEFAULT_SYSTEM_SETTINGS, id: '', created_at: '', updated_at: '' };
    },
    enabled: !!user,
  });

  const updateSystemSettings = useMutation({
    mutationFn: async (updatedData: Partial<SystemSettings>) => {
      appLogger.debug("Updating system settings");

      // Auto-generate currency symbol if currency code is being updated
      if (updatedData.currency_code) {
        updatedData.currency_symbol = getCurrencySymbol(updatedData.currency_code);
      }

      // First try to update existing settings
      let existingQuery = supabase
        .from("system_settings")
        .select("id");

      if (tenantId) {
        existingQuery = existingQuery.eq("tenant_id", tenantId);
      }

      const { data: existingData, error: checkError } = await existingQuery.maybeSingle();

      if (checkError) {
        appLogger.error("Error checking existing settings", checkError);
        throw checkError;
      }

      if (existingData?.id) {
        // Update existing
        let updateQuery = supabase
          .from("system_settings")
          .update(updatedData)
          .eq("id", existingData.id);

        if (tenantId) {
          updateQuery = updateQuery.eq("tenant_id", tenantId);
        }

        const { data, error } = await updateQuery
          .select()
          .single();

        if (error) {
          appLogger.error("Error updating system settings", error);
          throw error;
        }
        return data;
      } else {
        // Create new with auto-generated currency symbol
        const newSettings = { 
          ...DEFAULT_SYSTEM_SETTINGS, 
          ...updatedData,
          currency_symbol: getCurrencySymbol(updatedData.currency_code || DEFAULT_SYSTEM_SETTINGS.currency_code)
        };

        const insertPayload = tenantId ? { ...newSettings, tenant_id: tenantId } : newSettings;

        const { data, error } = await supabase
          .from("system_settings")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          appLogger.error("Error creating system settings", error);
          throw error;
        }
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings", tenantId] });
      toast.success("System settings updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update system settings");
      appLogger.error("Error updating system settings", error);
    },
  });

  useEffect(() => {
    if (!user) return;
    const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const channel = supabase
      .channel(`system-settings-${tenantId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_settings",
          ...(filter ? { filter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["systemSettings", tenantId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, user]);

  return {
    systemSettings: systemSettings || { 
      ...DEFAULT_SYSTEM_SETTINGS, 
      id: '', 
      created_at: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    },
    isLoading,
    error,
    updateSystemSettings: updateSystemSettings.mutate,
    isUpdating: updateSystemSettings.isPending,
  };
};
