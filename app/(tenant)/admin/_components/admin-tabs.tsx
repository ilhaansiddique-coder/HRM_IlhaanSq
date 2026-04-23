"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, ScrollText, Users, Database, Trash2 } from "lucide-react";
import { AnalyticsTab } from "./analytics-tab";
import { ActivityLogsTab } from "./activity-logs-tab";
import { UsersTab } from "./users-tab";
import { SystemTab } from "./system-tab";
import { TrashTab } from "./trash-tab";

export function AdminTabs(props: {
  currentUserId: string;
  analytics: any;
  recentActivity: any[];
  users: any[];
  activityLogs: any[];
  courierProviders: any[];
  systemStats: any;
  systemSettings: any;
  businessSettings: any;
  rolePermissions: Record<string, Record<string, boolean>>;
  deletedProducts: any[];
  deletedSales: any[];
  deletedCustomers: any[];
}) {
  return (
    <Tabs defaultValue="analytics" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="analytics" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Analytics</span>
        </TabsTrigger>
        <TabsTrigger value="logs" className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" />
          <span className="hidden sm:inline">Activity Logs</span>
        </TabsTrigger>
        <TabsTrigger value="users" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Users</span>
        </TabsTrigger>
        <TabsTrigger value="system" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <span className="hidden sm:inline">System</span>
        </TabsTrigger>
        <TabsTrigger value="trash" className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Trash</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="analytics" className="mt-4">
        <AnalyticsTab analytics={props.analytics} recentActivity={props.recentActivity} />
      </TabsContent>

      <TabsContent value="logs" className="mt-4">
        <ActivityLogsTab logs={props.activityLogs} />
      </TabsContent>

      <TabsContent value="users" className="mt-4">
        <UsersTab
          users={props.users}
          currentUserId={props.currentUserId}
          rolePermissions={props.rolePermissions}
        />
      </TabsContent>

      <TabsContent value="system" className="mt-4">
        <SystemTab
          systemStats={props.systemStats}
          systemSettings={props.systemSettings}
          businessSettings={props.businessSettings}
          courierProviders={props.courierProviders}
        />
      </TabsContent>

      <TabsContent value="trash" className="mt-4">
        <TrashTab
          deletedProducts={props.deletedProducts}
          deletedSales={props.deletedSales}
          deletedCustomers={props.deletedCustomers}
        />
      </TabsContent>
    </Tabs>
  );
}
