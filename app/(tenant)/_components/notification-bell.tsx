"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/lib/services/notifications.service";

const ACK_KEY = "rdi:notifications:ack";

function timeAgo(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

function describe(n: NotificationItem): string {
  // Action strings come from services in the form "product.created",
  // "sale.deleted", etc. We surface them in a friendly way.
  const action = n.action.replace(/[._]/g, " ");
  const target = n.entityType ? ` · ${n.entityType}` : "";
  return `${action}${target}`;
}

export function NotificationBell({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  // "Unread" = items newer than the last ack timestamp stored in
  // localStorage. Cheap, per-device, no server round-trip.
  const [ackTs, setAckTs] = useState<number>(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(ACK_KEY);
    setAckTs(raw ? Number(raw) : 0);
  }, []);

  const unreadCount = useMemo(
    () =>
      notifications.filter((n) => new Date(n.createdAt).getTime() > ackTs)
        .length,
    [notifications, ackTs]
  );

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next && notifications.length > 0) {
      const newest = new Date(notifications[0].createdAt).getTime();
      window.localStorage.setItem(ACK_KEY, String(newest));
      setAckTs(newest);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Notifications"
              className="relative h-9 w-9 rounded-lg border-border/60 bg-background/80"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2 text-xs">
          <span className="font-semibold">Notifications</span>
          {notifications.length > 0 && (
            <span className="text-muted-foreground">
              {notifications.length} recent
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[360px] overflow-y-auto py-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                No recent activity
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = new Date(n.createdAt).getTime() > ackTs;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-3 py-2 text-xs transition-colors hover:bg-muted/60 ${
                    isUnread ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      isUnread ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium capitalize">
                        {describe(n)}
                      </p>
                      {n.tenantName && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          {n.tenantName}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {n.actorName ?? "System"} · {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
