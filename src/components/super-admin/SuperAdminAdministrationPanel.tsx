import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Database, ScrollText, Shield, Trash2, Users } from "lucide-react";

import { ActivityLogs } from "@/components/admin/ActivityLogs";
import { BusinessAnalytics } from "@/components/admin/BusinessAnalytics";
import { SystemSettings } from "@/components/admin/SystemSettings";
import { UserManagement } from "@/components/admin/UserManagement";
import SupabaseOperationsPanel from "@/components/super-admin/SupabaseOperationsPanel";
import {
  getTenantBillingPlan,
  getTenants,
  tenantManagementQueryKeys,
} from "@/services/tenantService";
import {
  billingPlanDefinitions,
} from "@/constants/packagePlans";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Trash from "@/views/Trash";

const administrationTabs = [
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "logs", label: "Activity Logs", icon: ScrollText },
  { value: "users", label: "Users", icon: Users },
  { value: "system", label: "System", icon: Database },
  { value: "trash", label: "Trash", icon: Trash2 },
  // { value: "supabase", label: "Supabase Operations", icon: Workflow },
];

export function SuperAdminAdministrationPanel() {
  const [activeTab, setActiveTab] = useState("users");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  const tenantsQuery = useQuery({
    queryKey: tenantManagementQueryKeys.tenants,
    queryFn: getTenants,
  });

  useEffect(() => {
    if (selectedTenantId || !tenantsQuery.data?.length) {
      return;
    }

    setSelectedTenantId(tenantsQuery.data[0].id);
  }, [selectedTenantId, tenantsQuery.data]);

  const selectedTenant = useMemo(
    () => tenantsQuery.data?.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenantsQuery.data],
  );
  const tenantBillingQuery = useQuery({
    queryKey: selectedTenantId
      ? tenantManagementQueryKeys.billing(selectedTenantId)
      : ["tenant-management", "tenant-billing", "none"],
    queryFn: () => getTenantBillingPlan(selectedTenantId),
    enabled: !!selectedTenantId,
  });
  const currentPlanKey = tenantBillingQuery.data?.plan_key ?? "free";
  const currentPlan = billingPlanDefinitions[currentPlanKey];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Manage users, tenant-admin permissions, business performance, and system settings.
            </p>
            {selectedTenant && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Scoped tenant</span>
                  <Badge variant="outline">{selectedTenant.tenant_name}</Badge>
                  <Badge variant={selectedTenant.tenant_status === "active" ? "default" : "secondary"}>
                    {selectedTenant.tenant_status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Users</p>
                    <p className="text-sm font-semibold">{selectedTenant.users_count}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Customers</p>
                    <p className="text-sm font-semibold">{selectedTenant.customers_count}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Admin</p>
                    <p className="truncate text-sm font-semibold">{selectedTenant.tenant_admin_email || "Unassigned"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Current package</span>
                  <Badge variant="outline">{currentPlan.label}</Badge>
                  <Badge variant={currentPlanKey === "free" ? "secondary" : "default"}>
                    {currentPlan.priceLabel}
                  </Badge>
                  {tenantBillingQuery.data?.status ? (
                    <Badge variant="secondary">{tenantBillingQuery.data.status}</Badge>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="super-admin-administration-tenant">Tenant</Label>
          <Select
            value={selectedTenantId}
            onValueChange={setSelectedTenantId}
            disabled={tenantsQuery.isLoading || (tenantsQuery.data?.length ?? 0) === 0}
          >
            <SelectTrigger id="super-admin-administration-tenant">
              <SelectValue
                placeholder={tenantsQuery.isLoading ? "Loading tenants..." : "Select a tenant"}
              />
            </SelectTrigger>
            <SelectContent>
              {(tenantsQuery.data ?? []).map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.tenant_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl p-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-1">
          {administrationTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex h-auto min-h-[56px] w-full flex-col items-center justify-center gap-1.5 px-3 py-2 text-center text-xs sm:flex-row sm:gap-2 sm:text-sm lg:flex-1"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <BusinessAnalytics />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <ActivityLogs />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagement
            tenantIdOverride={selectedTenantId || null}
            allowTenantAdminPermissionEditing
            initialPermissionRole="tenant_admin"
          />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemSettings />
        </TabsContent>

        <TabsContent value="trash" className="space-y-4">
          <Trash />
        </TabsContent>

        <TabsContent value="supabase" className="space-y-4">
          <SupabaseOperationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SuperAdminAdministrationPanel;
