"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Search, CheckCheck, ShieldCheck, Activity } from "lucide-react";
import type { AdminNotification } from "@/lib/services/notifications-center.service";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "../actions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const SEV_DOT: Record<string, string> = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

export function NotificationsTab({
  notifications,
  unreadCount,
}: {
  notifications: AdminNotification[];
  unreadCount: number;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(
    () => Array.from(new Set(notifications.map((n) => n.category))),
    [notifications]
  );

  const filtered = notifications.filter((n) => {
    if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
    if (search) {
      const hay =
        `${n.title} ${n.body ?? ""} ${n.actorName ?? ""} ${n.type}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notifications
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {unreadCount} unread
            </Badge>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" size="sm" variant="outline" className="h-8 gap-1">
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </form>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[600px] space-y-2 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              <span className="text-sm">No notifications</span>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors ${
                  n.read ? "bg-background/40" : "bg-primary/5"
                }`}
              >
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.read ? "bg-transparent" : SEV_DOT[n.severity] ?? "bg-primary"
                  }`}
                />
                <Link
                  href={n.link ?? "/hr"}
                  className="min-w-0 flex-1 transition-colors hover:opacity-80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium capitalize">{n.title}</p>
                    <Badge variant="outline" className="gap-1 text-[10px] capitalize">
                      {n.category === "approval" ? (
                        <ShieldCheck className="h-2.5 w-2.5" />
                      ) : (
                        <Activity className="h-2.5 w-2.5" />
                      )}
                      {n.category}
                    </Badge>
                  </div>
                  {n.body && (
                    <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {n.actorName ?? "System"} · {timeAgo(n.createdAt)}
                  </p>
                  {n.actorId && (
                    <p
                      className="truncate font-mono text-[10px] text-muted-foreground/70"
                      title={`User ID: ${n.actorId}`}
                    >
                      ID: {n.actorId}
                    </p>
                  )}
                </Link>
                {n.source === "notification" && !n.read && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                    >
                      Mark read
                    </Button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>

        <p className="text-right text-xs text-muted-foreground">
          Showing {filtered.length} of {notifications.length}
        </p>
      </CardContent>
    </Card>
  );
}
