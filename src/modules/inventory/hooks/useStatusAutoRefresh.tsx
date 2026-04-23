import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseFunctionsBaseUrl } from '@/integrations/supabase/client';
import { appLogger } from '@/utils/logger';
import {
  buildSaleStatusUpdatePlan,
  LEGACY_SALE_STATUS_RULE_SNAPSHOT_SELECT,
  SALE_STATUS_RULE_SNAPSHOT_SELECT,
  type SaleStatusRuleSnapshot,
} from '@/lib/businessRules';
import { persistSaleStatusUpdate } from '@/modules/inventory/services/salesService';
import { useTenantMembership } from '@/hooks/useTenantMembership';

const fetchSaleStatusRuleSnapshot = async (
  saleId: string,
  tenantId: string,
): Promise<SaleStatusRuleSnapshot> => {
  let saleSnapshotResult = await supabase
    .from('sales')
    .select(SALE_STATUS_RULE_SNAPSHOT_SELECT)
    .eq('id', saleId)
    .eq('tenant_id', tenantId)
    .single();

  if (saleSnapshotResult.error) {
    const message = String(saleSnapshotResult.error.message || '').toLowerCase();
    const missingCreditTerms =
      message.includes('payment_terms') &&
      (message.includes('column') || message.includes('schema cache') || message.includes('parse'));

    if (missingCreditTerms) {
      saleSnapshotResult = await supabase
        .from('sales')
        .select(LEGACY_SALE_STATUS_RULE_SNAPSHOT_SELECT)
        .eq('id', saleId)
        .eq('tenant_id', tenantId)
        .single();
    }
  }

  const { data, error } = saleSnapshotResult;
  if (error) {
    throw error;
  }

  return data as SaleStatusRuleSnapshot;
};

export const useStatusAutoRefresh = () => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantMembership();

  useEffect(() => {
    if (!tenantId) return;

    let intervalId: NodeJS.Timeout | null = null;
    let currentIntervalMinutes: number | null = null;
    const tenantFilter = `tenant_id=eq.${tenantId}`;

    const setupAutoRefresh = async (refreshIntervalMinutes: number) => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        appLogger.debug('Cleared previous auto-refresh interval');
      }

      if (refreshIntervalMinutes === 0) {
        appLogger.debug('Auto-refresh is disabled by user settings');
        currentIntervalMinutes = 0;
        return;
      }

      appLogger.debug(`Auto-refresh enabled: checking every ${refreshIntervalMinutes} minutes`);
      currentIntervalMinutes = refreshIntervalMinutes;

      const refreshIntervalMs = refreshIntervalMinutes * 60 * 1000;

      const performRefresh = async () => {
        try {
          const { data: salesWithTracking } = await supabase
            .from('sales')
            .select('id, consignment_id, courier_name, courier_status')
            .eq('tenant_id', tenantId)
            .not('consignment_id', 'is', null)
            .neq('courier_status', 'delivered')
            .neq('courier_status', 'returned')
            .neq('courier_status', 'lost')
            .neq('courier_status', 'cancelled');

          if (!salesWithTracking || salesWithTracking.length === 0) return;

          const { data: webhookData } = await supabase
            .from('courier_webhook_settings')
            .select('status_check_webhook_url, is_active, steadfast_api_key, steadfast_secret_key')
            .eq('tenant_id', tenantId)
            .limit(1);

          const webhookSettings = webhookData?.[0];
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (sessionError || !accessToken) {
            console.error('Missing auth token for status check');
            return;
          }

          for (const sale of salesWithTracking) {
            try {
              const isSteadfast = sale.courier_name === 'Steadfast';
              const isPathao = sale.courier_name === 'Pathao';
              const isSundorban = sale.courier_name === 'Sundorban';
              const isJanani = sale.courier_name === 'Janani' || sale.courier_name === 'Janani Express';

              if (!isSteadfast && !isPathao && !isSundorban && !isJanani) {
                if (!webhookSettings?.status_check_webhook_url || !webhookSettings.is_active) continue;
              }

              let response: Response | null = null;
              let result: Record<string, unknown> | null = null;

              if (isSteadfast) {
                const steadfastApiKey = String(webhookSettings?.steadfast_api_key || '').trim();
                const steadfastSecretKey = String(webhookSettings?.steadfast_secret_key || '').trim();
                if (!steadfastApiKey || !steadfastSecretKey) {
                  console.error('Steadfast credentials not configured');
                  continue;
                }

                response = await fetch(`${supabaseFunctionsBaseUrl}/steadfast-status-check`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    consignment_id: sale.consignment_id,
                    api_key: steadfastApiKey,
                    secret_key: steadfastSecretKey,
                  }),
                });
              } else if (isSundorban) {
                response = await fetch(`${supabaseFunctionsBaseUrl}/sundorban-status-check`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    cn_number: sale.consignment_id,
                  }),
                });
              } else if (isJanani) {
                response = await fetch(`${supabaseFunctionsBaseUrl}/janani-status-check`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    cn_number: sale.consignment_id,
                  }),
                });
              } else if (isPathao) {
                response = await fetch(`${supabaseFunctionsBaseUrl}/pathao-status-check`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    consignment_id: sale.consignment_id,
                  }),
                });
              } else {
                response = await fetch(`${supabaseFunctionsBaseUrl}/courier-status-check`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({ consignment_id: sale.consignment_id }),
                });
              }

              if (!response || !response.ok) {
                continue;
              }

              result = await response.json();
              appLogger.debug('Status check response:', result);

              let newCourierStatus = 'pending';

              if (isSteadfast) {
                newCourierStatus = result.delivery_status || 'pending';
              } else if (isPathao) {
                newCourierStatus = result.mapped_status || 'pending';
              } else if (isSundorban || isJanani) {
                newCourierStatus = result.delivery_status || result.mapped_status || 'pending';
              } else {
                const payload = result?.webhook_response ?? result;

                if (Array.isArray(payload) && payload.length > 0) {
                  const firstResponse = payload[0];
                  if (firstResponse.type === 'success' && firstResponse.data) {
                    newCourierStatus = firstResponse.data.order_status || 'pending';
                  }
                } else if (payload.data && payload.data.order_status) {
                  newCourierStatus = payload.data.order_status;
                } else if (payload.order_status) {
                  newCourierStatus = payload.order_status;
                } else if (payload.status) {
                  newCourierStatus = payload.status;
                } else if (payload.courier_status) {
                  newCourierStatus = payload.courier_status;
                }
              }

              appLogger.debug('Extracted courier status:', newCourierStatus);

              const saleSnapshot = await fetchSaleStatusRuleSnapshot(sale.id, tenantId);
              const statusPlan = buildSaleStatusUpdatePlan({
                snapshot: saleSnapshot,
                rawStatus: newCourierStatus,
                lastStatusCheck: new Date().toISOString(),
              });

              appLogger.debug('Auto-refresh status plan:', {
                saleId: sale.id,
                original: newCourierStatus,
                display: statusPlan.displayStatus,
                previous: statusPlan.previousStatus,
                paymentUpdate: statusPlan.paymentUpdate,
                hasStatusChanged: statusPlan.hasStatusChanged,
                hasPaymentChanged: statusPlan.hasPaymentChanged,
              });

              await persistSaleStatusUpdate({
                saleId: sale.id,
                update: statusPlan.update,
              });

              if (statusPlan.hasStatusChanged) {
                appLogger.debug(`Auto-refresh updated sale ${sale.id} to ${statusPlan.displayStatus}`);
              } else {
                appLogger.debug(
                  `Status unchanged for sale ${sale.id} (${statusPlan.displayStatus}), updated timestamp only.`,
                );
              }
            } catch (error) {
              console.error(`Failed to refresh status for sale ${sale.id}:`, error);
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          queryClient.invalidateQueries({ queryKey: ['sales'] });
          appLogger.debug(`Auto-refreshed ${salesWithTracking.length} order statuses`);
        } catch (error) {
          console.error('Error in auto-refresh:', error);
        }
      };

      await performRefresh();
      intervalId = setInterval(performRefresh, refreshIntervalMs);
    };

    const initializeAutoRefresh = async () => {
      try {
        const { data: webhookData } = await supabase
          .from('courier_webhook_settings')
          .select('auto_refresh_interval_minutes')
          .eq('tenant_id', tenantId)
          .limit(1);

        const refreshIntervalMinutes = webhookData?.[0]?.auto_refresh_interval_minutes ?? 60;
        await setupAutoRefresh(refreshIntervalMinutes);
      } catch (error) {
        console.error('Error initializing auto-refresh:', error);
      }
    };

    const settingsSubscription = supabase
      .channel(`courier_settings_changes_${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'courier_webhook_settings',
          filter: tenantFilter,
        },
        async (payload: { new?: { auto_refresh_interval_minutes?: number | null } }) => {
          appLogger.debug('Courier settings updated, adjusting auto-refresh...');
          const newInterval = payload.new?.auto_refresh_interval_minutes ?? 60;

          if (newInterval !== currentIntervalMinutes) {
            appLogger.debug(`Interval changed from ${currentIntervalMinutes} to ${newInterval} minutes`);
            await setupAutoRefresh(newInterval);
          }
        },
      )
      .subscribe();

    initializeAutoRefresh();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        appLogger.debug('Auto-refresh interval cleared on unmount');
      }
      settingsSubscription.unsubscribe();
      appLogger.debug('Settings subscription unsubscribed');
    };
  }, [queryClient, tenantId]);

  return null;
};
