"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  ScrollText,
  Users,
  Database,
  Trash2,
  ShieldCheck,
  Bell,
  FileBarChart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnalyticsTab } from "./analytics-tab";
import { ActivityLogsTab } from "./activity-logs-tab";
import { UsersTab } from "./users-tab";
import { SystemTab } from "./system-tab";
import { TrashTab } from "./trash-tab";
import { ApprovalsTab } from "./approvals-tab";
import { NotificationsTab } from "./notifications-tab";
import { ReportsTab } from "./reports-tab";
import type { AdminNotification } from "@/lib/services/notifications-center.service";

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
  approvals: any[];
  approvalStats: { pending: number; approved: number; rejected: number };
  notifications: AdminNotification[];
  unreadNotifications: number;
  reports: any;
}) {
  return (
    <Tabs defaultValue="approvals" className="w-full">
      <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
        <TabsTrigger value="approvals" className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Approvals</span>
          {props.approvalStats.pending > 0 && (
            <Badge variant="destructive" className="ml-0.5 h-4 px-1 text-[10px]">
              {props.approvalStats.pending}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Notifications</span>
          {props.unreadNotifications > 0 && (
            <Badge variant="destructive" className="ml-0.5 h-4 px-1 text-[10px]">
              {props.unreadNotifications > 99 ? "99+" : props.unreadNotifications}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center gap-2">
          <FileBarChart className="h-4 w-4" />
          <span className="hidden sm:inline">Reports</span>
        </TabsTrigger>
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

      <TabsContent value="approvals" className="mt-4">
        <ApprovalsTab approvals={props.approvals} stats={props.approvalStats} />
      </TabsContent>

      <TabsContent value="notifications" className="mt-4">
        <NotificationsTab
          notifications={props.notifications}
          unreadCount={props.unreadNotifications}
        />
      </TabsContent>

      <TabsContent value="reports" className="mt-4">
        <ReportsTab reports={props.reports} />
      </TabsContent>

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
