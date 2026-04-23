import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { useTenantMembership } from "@/hooks/useTenantMembership";
import { useEffect } from "react";

export interface CourierWebhookSettings {
  id: string;
  webhook_url: string;
  webhook_name: string;
  webhook_description?: string;
  status_check_webhook_url: string;
  is_active: boolean;
  auth_username?: string;
  auth_password?: string;
  // Steadfast settings
  steadfast_api_key?: string;
  steadfast_secret_key?: string;
  steadfast_enabled: boolean;
  // Pathao settings
  pathao_client_id?: string;
  pathao_client_secret?: string;
  pathao_access_token?: string;
  pathao_token_expires_at?: string;
  pathao_store_id?: string;
  pathao_enabled: boolean;
  // General
  default_courier?: 'Steadfast' | 'Pathao' | null;
  auto_refresh_interval_minutes?: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_WEBHOOK_SETTINGS: Omit<CourierWebhookSettings, 'id' | 'created_at' | 'updated_at'> = {
  webhook_url: '',
  webhook_name: '',
  webhook_description: '',
  status_check_webhook_url: '',
  is_active: false,
  auth_username: '',
  auth_password: '',
  // Steadfast
  steadfast_api_key: '',
  steadfast_secret_key: '',
  steadfast_enabled: false,
  // Pathao
  pathao_client_id: '',
  pathao_client_secret: '',
  pathao_access_token: '',
  pathao_token_expires_at: undefined,
  pathao_store_id: '',
  pathao_enabled: false,
  // General
  default_courier: null,
  auto_refresh_interval_minutes: 60
};

export const useWebhookSettings = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const queryClient = useQueryClient();

  const {
    data: webhookSettings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["courierWebhookSettings", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("courier_webhook_settings")
        .select(
          "id, webhook_url, webhook_name, webhook_description, status_check_webhook_url, is_active, auth_username, steadfast_api_key, steadfast_secret_key, steadfast_enabled, pathao_client_id, pathao_client_secret, pathao_access_token, pathao_token_expires_at, pathao_store_id, pathao_enabled, default_courier, auto_refresh_interval_minutes, created_at, updated_at"
        )
        .order("updated_at", { ascending: false });

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        throw error;
      }

      // Return first row if exists, otherwise default settings
      return data?.[0] as CourierWebhookSettings || {
        ...DEFAULT_WEBHOOK_SETTINGS,
        id: '',
        created_at: '',
        updated_at: ''
      };
    },
    enabled: !!user,
  });

  const updateWebhookSettings = useMutation({
    mutationFn: async (updatedData: Partial<CourierWebhookSettings>) => {
      const payload = { ...updatedData };
      if (!payload.auth_password || payload.auth_password.trim() === "") {
        delete payload.auth_password;
      }

      // First try to update existing settings
      let existingQuery = supabase
        .from("courier_webhook_settings")
        .select("id");

      if (tenantId) {
        existingQuery = existingQuery.eq("tenant_id", tenantId);
      }

      const { data: existingData } = await existingQuery.limit(1);

      if (existingData?.[0]?.id) {
        // Update existing
        let updateQuery = supabase
          .from("courier_webhook_settings")
          .update(payload)
          .eq("id", existingData[0].id);

        if (tenantId) {
          updateQuery = updateQuery.eq("tenant_id", tenantId);
        }

        const { data, error } = await updateQuery
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const newSettings = {
          ...DEFAULT_WEBHOOK_SETTINGS,
          ...payload
        };

        const insertPayload = tenantId ? { ...newSettings, tenant_id: tenantId } : newSettings;

        const { data, error } = await supabase
          .from("courier_webhook_settings")
          .insert(insertPayload)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courierWebhookSettings", tenantId] });
      toast.success("Courier webhook settings updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update courier webhook settings");
      console.error("Error updating courier webhook settings:", error);
    },
  });

  // Helper to check if a courier is properly configured
  const isCourierConfigured = (courier: 'Steadfast' | 'Pathao'): boolean => {
    if (!webhookSettings) return false;
    if (courier === 'Steadfast') {
      return !!(webhookSettings.steadfast_api_key && webhookSettings.steadfast_secret_key);
    }
    if (courier === 'Pathao') {
      return !!(webhookSettings.pathao_access_token && webhookSettings.pathao_store_id);
    }
    return false;
  };

  // Helper to check if a courier is enabled
  const isCourierEnabled = (courier: 'Steadfast' | 'Pathao'): boolean => {
    if (!webhookSettings) return false;
    if (courier === 'Steadfast') return !!webhookSettings.steadfast_enabled;
    if (courier === 'Pathao') return !!webhookSettings.pathao_enabled;
    return false;
  };

  // Helper to check if courier is ready to use (configured AND enabled)
  const isCourierReady = (courier: 'Steadfast' | 'Pathao'): boolean => {
    return isCourierConfigured(courier) && isCourierEnabled(courier);
  };

  useEffect(() => {
    if (!user) return;
    const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const channel = supabase
      .channel(`courier-webhook-settings-${tenantId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "courier_webhook_settings",
          ...(filter ? { filter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["courierWebhookSettings", tenantId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, user]);

  return {
    webhookSettings: webhookSettings || null,
    isLoading,
    error,
    updateWebhookSettings: updateWebhookSettings.mutate,
    isUpdating: updateWebhookSettings.isPending,
    isCourierConfigured,
    isCourierEnabled,
    isCourierReady,
    refetchSettings: refetch,
  };
};
