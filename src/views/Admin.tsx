import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/admin/UserManagement";
import { BusinessAnalytics } from "@/components/admin/BusinessAnalytics";
import { SystemSettings } from "@/components/admin/SystemSettings";
import { ActivityLogs } from "@/components/admin/ActivityLogs";
import { PackagingQueue } from "@/components/admin/PackagingQueue";
import Trash from "@/views/Trash";
import { Users, BarChart3, Shield, Database, Trash2, ScrollText, CreditCard, Package } from "lucide-react";
import { Loader2 } from "lucide-react";
import { BillingSettings } from "@/components/admin/BillingSettings";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading, hasPermission } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check admin permissions
  const canManageRoles = hasPermission('admin.manage_roles');
  const canManagePermissions = hasPermission('admin.manage_permissions');

  const canAccessBackup = hasPermission('admin.full_backup') || hasPermission('admin.data_restore');
  const canAccessTrash = hasPermission("products.delete") || hasPermission("sales.delete") || hasPermission("customers.delete");
  const canViewLogs = hasPermission('logs.view');
  const canAccessPackaging = hasPermission('packaging.view');
  const canAccessBilling = hasPermission('billing.view') || hasPermission('billing.edit');

  // Users tab requires either manage_roles OR manage_permissions
  const canAccessUsers = canManageRoles || canManagePermissions;

  const defaultTab = useMemo(() => 'analytics', []);

  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(requestedTab || defaultTab);

  // Update active tab if it becomes inaccessible
  useEffect(() => {
    if (activeTab === 'users' && !canAccessUsers) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'packaging' && !canAccessPackaging) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'billing' && !canAccessBilling) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'system' && !canAccessBackup) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'trash' && !canAccessTrash) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'logs' && !canViewLogs) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, canAccessUsers, canAccessPackaging, canAccessBilling, canAccessBackup, canAccessTrash, canViewLogs, defaultTab]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Check if user has any admin permission
  const hasAnyAdminPermission =
    canAccessUsers ||
    canAccessBackup ||
    canAccessTrash ||
    canViewLogs ||
    canAccessBilling;

  if (!user || !hasAnyAdminPermission) {
    return <Navigate to="/" replace />;
  }

  if (isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto p-0">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <p className="text-muted-foreground">
              Manage users, monitor business performance, and configure system settings
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex flex-wrap w-full h-auto p-1 gap-1">
            <TabsTrigger value="analytics" className="flex items-center gap-2 flex-1">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            {canViewLogs && (
              <TabsTrigger value="logs" className="flex items-center gap-2 flex-1">
                <ScrollText className="h-4 w-4" />
                Activity Logs
              </TabsTrigger>
            )}
            {canAccessPackaging && (
              <TabsTrigger value="packaging" className="flex items-center gap-2 flex-1">
                <Package className="h-4 w-4" />
                Packaging
              </TabsTrigger>
            )}
            {canAccessUsers && (
              <TabsTrigger value="users" className="flex items-center gap-2 flex-1">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
            )}
            {canAccessBilling && (
              <TabsTrigger value="billing" className="flex items-center gap-2 flex-1">
                <CreditCard className="h-4 w-4" />
                Billing
              </TabsTrigger>
            )}
            {canAccessBackup && (
              <TabsTrigger value="system" className="flex items-center gap-2 flex-1">
                <Database className="h-4 w-4" />
                System
              </TabsTrigger>
            )}
            {canAccessTrash && (
              <TabsTrigger value="trash" className="flex items-center gap-2 flex-1">
                <Trash2 className="h-4 w-4" />
                Trash
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="analytics">
            <BusinessAnalytics />
          </TabsContent>

          {canViewLogs && (
            <TabsContent value="logs">
              <ActivityLogs />
            </TabsContent>
          )}

          {canAccessPackaging && (
            <TabsContent value="packaging">
              <PackagingQueue />
            </TabsContent>
          )}

          {canAccessUsers && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}

          {canAccessBilling && (
            <TabsContent value="billing">
              <BillingSettings />
            </TabsContent>
          )}

          {canAccessBackup && (
            <TabsContent value="system">
              <SystemSettings />
            </TabsContent>
          )}

          {canAccessTrash && (
            <TabsContent value="trash">
              <Trash />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
