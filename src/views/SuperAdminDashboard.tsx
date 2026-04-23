import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  Home,
  Loader2,
  LogOut,
  Palette,
  Shield,
  User,
  UserPlus,
} from "lucide-react";

import { useAuth } from "@/core/auth/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { useUserRole } from "@/core/auth/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "@/lib/time";
import { invokeProtectedApi } from "@/utils/invokeProtectedApi";
import { ActivityLogs } from "@/components/admin/ActivityLogs";
import { DemoRequestsInbox } from "@/components/admin/DemoRequestsInbox";
import { AppearanceTab } from "@/components/AppearanceTab";
import { ProfileTab } from "@/components/ProfileTab";
import Settings from "@/views/Settings";
import SuperAdminAdministrationPanel from "@/components/super-admin/SuperAdminAdministrationPanel";
import TenantManagementPanel from "@/components/super-admin/TenantManagementPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SuperAdminTab =
  | "home"
  | "tenants"
  | "tenant-requests"
  | "reports"
  | "alerts"
  | "settings"
  | "administration"
  | "profile"
  | "theme"
  | "sign-out";

const SUPER_ADMIN_TABS: SuperAdminTab[] = [
  "home",
  "tenants",
  "tenant-requests",
  "reports",
  "alerts",
  "settings",
  "administration",
  "profile",
  "theme",
  "sign-out",
];

interface SuperAdminOverview {
  generated_at: string;
  totals: {
    tenants_total: number;
    tenants_active: number;
    tenants_inactive: number;
    user_count: number;
    customer_count: number;
    today_order_count: number;
    today_transaction_amount: number;
    pending_request_count: number;
    failed_notification_count: number;
  };
}

interface SuperAdminTenantRow {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  company_name: string;
  users_count: number;
  customers_count: number;
  daily_transaction_amount: number;
  daily_order_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type LooseRow = Record<string, unknown>;

const DHAKA_TIME_ZONE = "Asia/Dhaka";
const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  "";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const OVERVIEW_TABS = new Set<SuperAdminTab>(["home", "alerts", "tenants"]);
const TENANT_METRIC_TABS = new Set<SuperAdminTab>(["reports", "alerts"]);

const isPrivateIpv4Address = (hostname: string) =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const shouldPreferDirectSuperAdminData = (rawApiUrl: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  if (!rawApiUrl) {
    return true;
  }

  try {
    const parsedUrl = new URL(rawApiUrl);
    return LOCAL_HOSTNAMES.has(parsedUrl.hostname.toLowerCase()) || isPrivateIpv4Address(parsedUrl.hostname);
  } catch {
    return false;
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
};

const isSuperAdminApiUnavailable = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /cannot connect to api|failed to fetch|networkerror|err_connection_refused|econnrefused|service unavailable|statuscode":503|platform db is unavailable|getaddrinfo enotfound|enotfound/i.test(
    message,
  );
};

const normalizeSuperAdminTenantRow = (row: SuperAdminTenantRow): SuperAdminTenantRow => ({
  ...row,
  users_count: Number(row.users_count ?? 0),
  customers_count: Number(row.customers_count ?? 0),
  daily_transaction_amount: Number(row.daily_transaction_amount ?? 0),
  daily_order_quantity: Number(row.daily_order_quantity ?? 0),
});

const loadSuperAdminTenantRowsDirect = async (): Promise<SuperAdminTenantRow[]> => {
  const todayKey = formatInTimeZone(new Date(), "yyyy-MM-dd", DHAKA_TIME_ZONE);
  const salesWindowStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [tenantsResult, businessSettingsResult, tenantMembersResult, customersResult, salesResult] = await Promise.all([
    (supabase as any).from("tenants").select("id, slug, name, is_active, created_at, updated_at"),
    (supabase as any).from("business_settings").select("tenant_id, business_name, updated_at"),
    (supabase as any).from("tenant_members").select("tenant_id, is_active"),
    (supabase as any).from("customers").select("tenant_id, is_deleted"),
    (supabase as any).from("sales").select("tenant_id, created_at, grand_total, fee").gte("created_at", salesWindowStart),
  ]);

  if (tenantsResult.error) {
    throw new Error(tenantsResult.error.message || "Failed to load tenants");
  }
  if (businessSettingsResult.error) {
    throw new Error(businessSettingsResult.error.message || "Failed to load business settings");
  }
  if (tenantMembersResult.error) {
    throw new Error(tenantMembersResult.error.message || "Failed to load tenant members");
  }
  if (customersResult.error) {
    throw new Error(customersResult.error.message || "Failed to load customers");
  }
  if (salesResult.error) {
    throw new Error(salesResult.error.message || "Failed to load sales");
  }

  const businessNameByTenant = new Map<string, { businessName: string; updatedAt: string }>();
  ((businessSettingsResult.data ?? []) as LooseRow[]).forEach((row) => {
    const tenantId = String(row.tenant_id ?? "");
    const businessName = String(row.business_name ?? "").trim();
    const updatedAt = String(row.updated_at ?? "");

    if (!tenantId || !businessName) {
      return;
    }

    const existing = businessNameByTenant.get(tenantId);
    if (!existing || updatedAt > existing.updatedAt) {
      businessNameByTenant.set(tenantId, { businessName, updatedAt });
    }
  });

  const customerCountByTenant = new Map<string, number>();
  const userCountByTenant = new Map<string, number>();
  ((tenantMembersResult.data ?? []) as LooseRow[]).forEach((row) => {
    if (row.is_active === false) {
      return;
    }

    const tenantId = String(row.tenant_id ?? "");
    if (!tenantId) {
      return;
    }

    userCountByTenant.set(tenantId, (userCountByTenant.get(tenantId) ?? 0) + 1);
  });

  ((customersResult.data ?? []) as LooseRow[]).forEach((row) => {
    if (row.is_deleted) {
      return;
    }

    const tenantId = String(row.tenant_id ?? "");
    if (!tenantId) {
      return;
    }

    customerCountByTenant.set(tenantId, (customerCountByTenant.get(tenantId) ?? 0) + 1);
  });

  const dailyMetricsByTenant = new Map<string, { orders: number; revenue: number }>();
  ((salesResult.data ?? []) as LooseRow[]).forEach((row) => {
    const tenantId = String(row.tenant_id ?? "");
    const createdAt = String(row.created_at ?? "");
    if (!tenantId || !createdAt) {
      return;
    }

    if (formatInTimeZone(new Date(createdAt), "yyyy-MM-dd", DHAKA_TIME_ZONE) !== todayKey) {
      return;
    }

    const entry = dailyMetricsByTenant.get(tenantId) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += Math.max(0, (Number(row.grand_total ?? 0) || 0) - (Number(row.fee ?? 0) || 0));
    dailyMetricsByTenant.set(tenantId, entry);
  });

  return ((tenantsResult.data ?? []) as LooseRow[])
    .map((row) => {
      const tenantId = String(row.id ?? "");
      const dailyMetrics = dailyMetricsByTenant.get(tenantId) ?? { orders: 0, revenue: 0 };
      return {
        tenant_id: tenantId,
        tenant_slug: String(row.slug ?? ""),
        tenant_name: String(row.name ?? ""),
        company_name: businessNameByTenant.get(tenantId)?.businessName ?? String(row.name ?? ""),
        users_count: userCountByTenant.get(tenantId) ?? 0,
        customers_count: customerCountByTenant.get(tenantId) ?? 0,
        daily_transaction_amount: dailyMetrics.revenue,
        daily_order_quantity: dailyMetrics.orders,
        is_active: Boolean(row.is_active),
        created_at: String(row.created_at ?? ""),
        updated_at: String(row.updated_at ?? ""),
      };
    })
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
};

const loadSuperAdminOverviewDirect = async (): Promise<SuperAdminOverview> => {
  const [tenantRows, demoRequestsResult] = await Promise.all([
    loadSuperAdminTenantRowsDirect(),
    (supabase as any)
      .from("demo_requests" as never)
      .select("status, request_notification_status"),
  ]);

  if (demoRequestsResult.error) {
    throw new Error(demoRequestsResult.error.message || "Failed to load demo requests");
  }

  const demoRequests = (demoRequestsResult.data ?? []) as Array<{
    status?: string | null;
    request_notification_status?: string | null;
  }>;

  const totals = tenantRows.reduce(
    (acc, row) => {
      acc.tenants_total += 1;
      acc.user_count += row.users_count;
      acc.customer_count += row.customers_count;
      acc.today_order_count += row.daily_order_quantity;
      acc.today_transaction_amount += row.daily_transaction_amount;

      if (row.is_active) {
        acc.tenants_active += 1;
      } else {
        acc.tenants_inactive += 1;
      }

      return acc;
    },
    {
      tenants_total: 0,
      tenants_active: 0,
      tenants_inactive: 0,
      user_count: 0,
      customer_count: 0,
      today_order_count: 0,
      today_transaction_amount: 0,
      pending_request_count: demoRequests.filter((row) => row.status === "pending").length,
      failed_notification_count: demoRequests.filter((row) =>
        row.request_notification_status === "failed" || row.request_notification_status === "skipped",
      ).length,
    },
  );

  return {
    generated_at: new Date().toISOString(),
    totals,
  };
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-BD", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const normalizeRequestedTab = (value: string | null): SuperAdminTab => {
  if (!value) return "home";
  return SUPER_ADMIN_TABS.includes(value as SuperAdminTab) ? (value as SuperAdminTab) : "home";
};

export default function SuperAdminDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();
  const { formatAmount } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SuperAdminTab>(normalizeRequestedTab(searchParams.get("tab")));

  useEffect(() => {
    setActiveTab(normalizeRequestedTab(searchParams.get("tab")));
  }, [searchParams]);

  const shouldLoadOverview = isSuperAdmin && OVERVIEW_TABS.has(activeTab);
  const shouldLoadTenantMetrics = isSuperAdmin && TENANT_METRIC_TABS.has(activeTab);

  const overviewQuery = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: async () => {
      if (shouldPreferDirectSuperAdminData(configuredApiUrl)) {
        return loadSuperAdminOverviewDirect();
      }

      try {
        const data = await invokeProtectedApi<SuperAdminOverview>("/platform/super-admin/overview");
        return {
          ...data,
          totals: {
            ...data.totals,
            user_count: Number(data.totals?.user_count ?? 0),
            customer_count: Number(data.totals?.customer_count ?? 0),
            today_order_count: Number(data.totals?.today_order_count ?? 0),
            today_transaction_amount: Number(data.totals?.today_transaction_amount ?? 0),
          },
        };
      } catch (error) {
        if (!isSuperAdminApiUnavailable(error)) {
          throw error;
        }
        return loadSuperAdminOverviewDirect();
      }
    },
    enabled: shouldLoadOverview,
    staleTime: 30_000,
    retry: false,
  });

  const tenantsQuery = useQuery({
    queryKey: ["super-admin-tenants"],
    queryFn: async () => {
      if (shouldPreferDirectSuperAdminData(configuredApiUrl)) {
        return loadSuperAdminTenantRowsDirect();
      }

      try {
        const rows = await invokeProtectedApi<SuperAdminTenantRow[]>("/platform/super-admin/tenants");
        return rows.map(normalizeSuperAdminTenantRow);
      } catch (error) {
        if (!isSuperAdminApiUnavailable(error)) {
          throw error;
        }
        return loadSuperAdminTenantRowsDirect();
      }
    },
    enabled: shouldLoadTenantMetrics,
    staleTime: 30_000,
    retry: false,
  });

  const topTenantsByRevenue = useMemo(
    () =>
      [...(tenantsQuery.data ?? [])]
        .sort((left, right) => right.daily_transaction_amount - left.daily_transaction_amount)
        .slice(0, 10),
    [tenantsQuery.data],
  );

  const attentionAlerts = useMemo(() => {
    const rows = tenantsQuery.data ?? [];
    const inactiveTenants = rows.filter((row) => !row.is_active).length;
    const zeroOrderTenants = rows.filter((row) => row.daily_order_quantity === 0).length;
    return { inactiveTenants, zeroOrderTenants };
  }, [tenantsQuery.data]);

  const handleTabChange = (value: string) => {
    const nextTab = normalizeRequestedTab(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    nextParams.delete("tenantId");
    setSearchParams(nextParams, { replace: true });
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const overview = overviewQuery.data?.totals;

  return (
    <div className="min-h-screen bg-transparent space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsContent value="home" className="space-y-4">
          {overviewQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading overview...</div>
          ) : overviewQuery.error ? (
            <div className="text-sm text-destructive">
              Failed to load platform overview: {(overviewQuery.error as Error).message}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Tenants</CardDescription>
                  <CardTitle>{overview?.tenants_total ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Tenants</CardDescription>
                  <CardTitle>{overview?.tenants_active ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Active Users</CardDescription>
                  <CardTitle>{overview?.user_count ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Customers</CardDescription>
                  <CardTitle>{overview?.customer_count ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Today's Transactions</CardDescription>
                  <CardTitle>{formatAmount(overview?.today_transaction_amount ?? 0)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Today's Orders</CardDescription>
                  <CardTitle>{overview?.today_order_count ?? 0}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <TenantManagementPanel overview={overview} />
        </TabsContent>

        <TabsContent value="tenant-requests">
          <DemoRequestsInbox />
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>System-Wide Reports</CardTitle>
              <CardDescription>Top tenants by daily revenue for platform monitoring.</CardDescription>
            </CardHeader>
            <CardContent>
              {tenantsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading report data...</div>
              ) : (
                <>
                  <div className="md:hidden rounded-2xl border border-border/70 bg-background/30 p-3">
                    <div className="space-y-3">
                      {topTenantsByRevenue.map((tenant) => (
                        <div key={tenant.tenant_id} className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{tenant.tenant_name}</p>
                            <p className="mt-1 truncate text-sm text-muted-foreground">{tenant.company_name}</p>
                          </div>
                          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                            <span className="text-muted-foreground">Daily Revenue</span>
                            <span className="justify-self-end text-right font-medium">
                              {formatAmount(tenant.daily_transaction_amount)}
                            </span>
                            <span className="text-muted-foreground">Users</span>
                            <span className="justify-self-end text-right font-medium">
                              {tenant.users_count}
                            </span>
                            <span className="text-muted-foreground">Daily Orders</span>
                            <span className="justify-self-end text-right font-medium">
                              {tenant.daily_order_quantity} orders
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Daily Revenue</TableHead>
                          <TableHead>Daily Orders</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topTenantsByRevenue.map((tenant) => (
                          <TableRow key={tenant.tenant_id}>
                            <TableCell>{tenant.tenant_name}</TableCell>
                            <TableCell>{tenant.company_name}</TableCell>
                            <TableCell>{tenant.users_count}</TableCell>
                            <TableCell>{formatAmount(tenant.daily_transaction_amount)}</TableCell>
                            <TableCell>{tenant.daily_order_quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Tenant Requests</CardDescription>
                <CardTitle>{overview?.pending_request_count ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Notification Failures</CardDescription>
                <CardTitle>{overview?.failed_notification_count ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Inactive Tenants</CardDescription>
                <CardTitle>{attentionAlerts.inactiveTenants}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tenants With 0 Daily Orders</CardDescription>
                <CardTitle>{attentionAlerts.zeroOrderTenants}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Recommended Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Review tenant requests and failed notifications to avoid onboarding delays.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleTabChange("tenant-requests")}>
                  Open Tenant Requests
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleTabChange("tenants")}>
                  Open Tenant List
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Settings />
        </TabsContent>

        <TabsContent value="administration" className="space-y-4">
          <SuperAdminAdministrationPanel />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="theme">
          <AppearanceTab />
        </TabsContent>

        <TabsContent value="sign-out">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                Sign Out
              </CardTitle>
              <CardDescription>End your current superadmin session.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={signOut}>
                Sign Out Now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
