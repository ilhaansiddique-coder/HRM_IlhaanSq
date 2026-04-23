import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/utils/toast";
import { appLogger } from "@/utils/logger";
import { useTenantMembership } from "./useTenantMembership";
import { useEffect } from "react";

export interface CustomSetting {
  id: string;
  setting_type: 'custom_css' | 'head_snippet' | 'body_snippet';
  content: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const useCustomSettings = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const queryClient = useQueryClient();

  const {
    data: customSettings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["customSettings", tenantId],
    queryFn: async () => {
      appLogger.debug('Fetching custom settings...');
      try {
        let query = supabase
          .from("custom_settings")
          .select("*")
          .order('setting_type');

        if (tenantId) {
          query = query.eq("tenant_id", tenantId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching custom settings:', error);
          throw error;
        }
        
        appLogger.debug('Custom settings fetched:', data);
        return data as CustomSetting[];
      } catch (err) {
        console.error('Network error fetching custom settings:', err);
        // Try to get from localStorage as fallback
        try {
          const stored = localStorage.getItem('custom_settings_fallback');
          if (stored) {
            appLogger.debug('Using fallback custom settings from localStorage');
            return JSON.parse(stored);
          }
        } catch (localErr) {
          console.error('Error reading from localStorage:', localErr);
        }
        // Return empty array as final fallback
        return [];
      }
    },
    retry: 3,
    retryDelay: 1000,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const updateCustomSetting = useMutation({
    mutationFn: async ({ 
      setting_type, 
      content, 
      is_enabled 
    }: { 
      setting_type: CustomSetting['setting_type']; 
      content: string; 
      is_enabled: boolean;
    }) => {
      appLogger.debug('Updating custom setting:', { setting_type, content, is_enabled });
      
      // First try to update existing setting
    let existingQuery = supabase
        .from("custom_settings")
        .select("id")
        .eq("setting_type", setting_type);

      if (tenantId) {
        existingQuery = existingQuery.eq("tenant_id", tenantId);
      }

      const { data: existingData, error: selectError } = await existingQuery.maybeSingle();

      if (selectError) {
        console.error('Error checking existing setting:', selectError);
        throw selectError;
      }

      if (existingData?.id) {
        // Update existing
        appLogger.debug('Updating existing setting:', existingData.id);
        let updateQuery = supabase
          .from("custom_settings")
          .update({ 
            content, 
            is_enabled,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingData.id);

        if (tenantId) {
          updateQuery = updateQuery.eq("tenant_id", tenantId);
        }

        const { data, error } = await updateQuery
          .select()
          .single();

        if (error) {
          console.error('Error updating setting:', error);
          throw error;
        }
        appLogger.debug('Setting updated successfully:', data);
        return data;
      } else {
        // Create new
        appLogger.debug('Creating new setting');
        const { data, error } = await supabase
          .from("custom_settings")
          .insert({ 
            setting_type, 
            content, 
            is_enabled,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(tenantId ? { tenant_id: tenantId } : {})
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating setting:', error);
          throw error;
        }
        appLogger.debug('Setting created successfully:', data);
        return data;
      }
    },
    onSuccess: (data, variables) => {
      appLogger.debug('Setting saved successfully:', data);
      queryClient.invalidateQueries({ queryKey: ["customSettings", tenantId] });
      toast.success(`${variables.setting_type.replace('_', ' ')} saved successfully`);
    },
    onError: (error, variables) => {
      console.error('Error updating custom setting:', error);
      toast.error(`Failed to save ${variables.setting_type.replace('_', ' ')}`);
    },
  });

  // Helper functions to get specific settings
  const getCustomCSS = () => {
    return customSettings?.find(s => s.setting_type === 'custom_css');
  };

  const getHeadSnippet = () => {
    return customSettings?.find(s => s.setting_type === 'head_snippet');
  };

  const getBodySnippet = () => {
    return customSettings?.find(s => s.setting_type === 'body_snippet');
  };

  useEffect(() => {
    if (!user) return;
    const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;
    const channel = supabase
      .channel(`custom-settings-${tenantId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custom_settings",
          ...(filter ? { filter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["customSettings", tenantId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, user]);

  return {
    customSettings: customSettings || [],
    getCustomCSS,
    getHeadSnippet,
    getBodySnippet,
    isLoading,
    error,
    refetch,
    updateCustomSetting: updateCustomSetting.mutateAsync,
    isUpdating: updateCustomSetting.isPending,
  };
};

