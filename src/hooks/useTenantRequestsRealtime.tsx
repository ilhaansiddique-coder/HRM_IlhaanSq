import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/utils/toast";

interface DemoRequestRealtimeRow {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  status: string;
  created_at: string;
}

export const TENANT_REQUESTS_PENDING_QUERY_KEY = ["tenant-requests-pending-count"] as const;

export const useTenantRequestsRealtime = () => {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useUserRole();
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const { data: pendingCount = 0, isLoading } = useQuery({
    queryKey: TENANT_REQUESTS_PENDING_QUERY_KEY,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("demo_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    enabled: isSuperAdmin,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      seenRequestIdsRef.current.clear();
      initializedRef.current = false;
      return;
    }

    let isMounted = true;

    const primeSeenRequests = async () => {
      const { data, error } = await (supabase as any)
        .from("demo_requests")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!isMounted || error) {
        return;
      }

      seenRequestIdsRef.current = new Set(
        ((data ?? []) as Array<{ id: string | null }>).map((row) => row.id).filter(Boolean) as string[],
      );
      initializedRef.current = true;
    };

    void primeSeenRequests();

    const channel = supabase
      .channel("tenant-requests-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "demo_requests",
        },
        (payload) => {
          const newRequest = payload.new as DemoRequestRealtimeRow;
          queryClient.invalidateQueries({ queryKey: TENANT_REQUESTS_PENDING_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: ["tenant-requests-superadmin"] });

          if (!initializedRef.current || newRequest.status !== "pending") {
            seenRequestIdsRef.current.add(newRequest.id);
            return;
          }

          if (seenRequestIdsRef.current.has(newRequest.id)) {
            return;
          }

          seenRequestIdsRef.current.add(newRequest.id);
          toast.info("New tenant request received", {
            description: `${newRequest.business_name} · ${newRequest.full_name}`,
            duration: 8000,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demo_requests",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: TENANT_REQUESTS_PENDING_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: ["tenant-requests-superadmin"] });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, queryClient]);

  return {
    pendingCount,
    isLoading,
  };
};
