import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/utils/toast";
import { useTenantMembership } from '@/hooks/useTenantMembership';

export const useCourierStatusRealtime = () => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);
  const { tenantId } = useTenantMembership();

  useEffect(() => {
    if (!tenantId) return;

    // Subscribe to real-time changes on the sales table
    subscriptionRef.current = supabase
      .channel(`courier-status-updates-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          console.log('Real-time courier status update:', payload);
          
          const { new: newRecord, old: oldRecord } = payload;
          
          if (newRecord && oldRecord && newRecord.courier_status !== oldRecord.courier_status) {
            // Show toast notification for status change
            const statusChange = `${oldRecord.courier_status || 'PENDING'} → ${newRecord.courier_status}`;
            toast.success(`Order ${newRecord.invoice_number} status updated: ${statusChange}`, {
              description: `Customer: ${newRecord.customer_name}`,
              duration: 5000,
            });

            // Invalidate and refetch sales data to update UI
            queryClient.invalidateQueries({ queryKey: ["sales"] });
            
            // Also invalidate any specific sale queries
            queryClient.invalidateQueries({ 
              queryKey: ["sale", newRecord.id] 
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'courier_status_logs'
        },
        (payload) => {
          console.log('New courier status log:', payload);
          // Optionally handle new status logs
        }
      )
      .subscribe((status) => {
        console.log('Courier status subscription status:', status);
      });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [queryClient, tenantId]);

  return null;
};
