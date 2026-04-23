import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/core/auth/useAuth";
import { toast } from "@/utils/toast";
import { useEffect } from "react";

export const useProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profileData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Fetch profile and user role in parallel
      const [profileResponse, roleResponse] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      if (profileResponse.error) throw profileResponse.error;
      if (roleResponse.error) throw roleResponse.error;

      return {
        profile: profileResponse.data,
        role: roleResponse.data?.role || 'staff'
      };
    },
    enabled: !!user?.id,
    // Add caching and performance optimizations
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { full_name?: string; phone?: string; email?: string }) => {
      if (!user?.id) throw new Error("No user found");

      const { email, ...profileUpdates } = updates;
      
      // Only update email if it's different from current email and user explicitly changed it
      if (email && email !== user.email && email.trim() !== '' && email !== user.user_metadata?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }

      // Handle profile updates using upsert to avoid duplicate key issues
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            full_name: profileUpdates.full_name || user.email?.split('@')[0] || 'User',
            phone: profileUpdates.phone || null
          }, {
            onConflict: 'id'
          });
        
        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const profileChannel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        },
      )
      .subscribe();

    const rolesChannel = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [queryClient, user?.id]);

  return {
    profile: profileData?.profile,
    role: profileData?.role,
    isLoading,
    error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
};
