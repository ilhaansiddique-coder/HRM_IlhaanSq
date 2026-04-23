import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/utils/toast";
import { appLogger } from "@/utils/logger";
import { useEffect } from "react";

export interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  low_stock_alerts: boolean;
  sales_reports: boolean;
  dark_mode: boolean;
  compact_view: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  email_notifications: true,
  low_stock_alerts: true,
  sales_reports: true,
  dark_mode: false,
  compact_view: false
};

export const useUserPreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: preferences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["userPreferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updatedData: Partial<UserPreferences>) => {
      if (!user?.id) throw new Error("User not authenticated");

      // If a row exists for this user, update it, otherwise create one
      if (preferences?.id) {
        const { data, error } = await supabase
          .from("user_preferences")
          .update(updatedData)
          .eq("id", preferences.id)
          .select()
          .single();
        
        if (error) {
          appLogger.error("Update preferences error", error);
          throw error;
        }
        return data;
      } else {
        const newPreferences = {
          ...DEFAULT_PREFERENCES,
          ...updatedData,
          user_id: user.id,
        };
        const { data, error } = await supabase
          .from("user_preferences")
          .insert(newPreferences)
          .select()
          .single();
        
        if (error) {
          appLogger.error("Insert preferences error", error);
          throw error;
        }
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences", user?.id] });
      toast.success("Preferences updated successfully");
    },
    onError: (error) => {
      appLogger.error("Mutation error while updating preferences", error);
      toast.error("Failed to update preferences");
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-preferences-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_preferences",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["userPreferences", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return {
    preferences: preferences || { 
      ...DEFAULT_PREFERENCES, 
      id: '', 
      user_id: user?.id || '',
      created_at: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    },
    isLoading,
    error,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
};
