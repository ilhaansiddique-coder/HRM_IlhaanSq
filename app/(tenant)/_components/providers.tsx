"use client";

import { createContext, useContext, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppSession } from "@/lib/auth";

// ─── Tenant Context ─────────────────────────────────────────

type TenantContextValue = {
  session: AppSession & { tenantId: string; tenantSlug: string };
  businessSettings: any;
  systemSettings: any;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProviders");
  return ctx;
}

// ─── Currency Helper ────────────────────────────────────────

export function useCurrency() {
  const { systemSettings } = useTenant();
  const symbol = systemSettings?.currencySymbol ?? "$";
  const code = systemSettings?.currencyCode ?? "USD";

  function formatAmount(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return `${symbol}0`;
    return `${symbol}${Math.round(num).toLocaleString()}`;
  }

  function formatAmountDetailed(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return `${symbol}0.00`;
    return `${symbol}${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return { symbol, code, formatAmount, formatAmountDetailed };
}

// ─── Query Client ───────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Providers ──────────────────────────────────────────────

export function TenantProviders({
  children,
  session,
  businessSettings,
  systemSettings,
}: {
  children: ReactNode;
  session: AppSession & { tenantId: string; tenantSlug: string };
  businessSettings: any;
  systemSettings: any;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantContext.Provider
        value={{ session, businessSettings, systemSettings }}
      >
        {children}
      </TenantContext.Provider>
    </QueryClientProvider>
  );
}
