"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScrollText,
  Users,
  Database,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActivityLogsTab } from "./activity-logs-tab";
import { UsersTab } from "./users-tab";
import { SystemTab } from "./system-tab";
import { ApprovalsTab } from "./approvals-tab";
import { NotificationsTab } from "./notifications-tab";
import type { AdminNotification } from "@/lib/services/notifications-center.service";

export function AdminTabs(props: {
  currentUserId: string;
  users: any[];
  activityLogs: any[];
  systemStats: any;
  systemSettings: any;
  businessSettings: any;
  rolePermissions: Record<string, Record<string, boolean>>;
  approvals: any[];
  approvalStats: { pending: number; approved: number; rejected: number };
  notifications: AdminNotification[];
  unreadNotifications: number;
}) {
  return (
    <Tabs defaultValue="approvals" className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
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
        />
      </TabsContent>
    </Tabs>
  );
}
