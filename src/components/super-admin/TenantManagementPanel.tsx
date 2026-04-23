import { useState } from "react";

import RoleManager from "@/components/super-admin/RoleManager";
import TenantEmployeeList from "@/components/super-admin/TenantEmployeeList";
import TenantList from "@/components/super-admin/TenantList";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TenantManagementOverview {
  tenants_total: number;
  tenants_active: number;
  tenants_inactive: number;
  user_count?: number;
  pending_request_count: number;
}

export interface TenantManagementPanelProps {
  overview?: TenantManagementOverview;
}

export function TenantManagementPanel({ overview }: TenantManagementPanelProps) {
  const [activeView, setActiveView] = useState("all-tenants");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Total Tenants</p>
            <CardTitle>{overview?.tenants_total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Active Tenants</p>
            <CardTitle>{overview?.tenants_active ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Inactive Tenants</p>
            <CardTitle>{overview?.tenants_inactive ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Active Users</p>
            <CardTitle>{overview?.user_count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Pending Requests</p>
            <CardTitle>{overview?.pending_request_count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="all-tenants">All Tenants</TabsTrigger>
          <TabsTrigger value="tenant-employees">Tenant Employees</TabsTrigger>
          <TabsTrigger value="role-management">Role Management</TabsTrigger>
        </TabsList>

        <TabsContent value="all-tenants" className="space-y-4">
          <TenantList />
        </TabsContent>

        <TabsContent value="tenant-employees" className="space-y-4">
          <TenantEmployeeList />
        </TabsContent>

        <TabsContent value="role-management" className="space-y-4">
          <RoleManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TenantManagementPanel;
