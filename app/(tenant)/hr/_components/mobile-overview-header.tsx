"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Users, CalendarClock, CalendarDays, Wallet } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DateRangePicker } from "../../_components/date-range-picker";
import { NotificationBell } from "../../_components/notification-bell";
import type { NotificationItem } from "@/lib/services/notifications.service";

// Mobile-only dashboard header.
//   ┌──────────────────────────────────┐
//   │ Dashboard           [📅 Today ]  │
//   │ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │
//   │ │👥│ │🕒│ │📅│ │💰│              │
//   │ Employees Attend. Leave Payroll  │
//   └──────────────────────────────────┘
// Wrapped in `lg:hidden` so desktop (>= 1024px) keeps the existing
// TopBar layout. Tablets fall under this and use the mobile header
// like phones — matches the boundary in tenant-shell.tsx.
// The TopBar's own date picker is hidden on mobile so we don't show
// the same control twice.
export function MobileDashboardHeader({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  return (
    // TooltipProvider is needed because NotificationBell uses Tooltip;
    // the global one in TenantShell only wraps the desktop TopBar.
    <TooltipProvider delayDuration={150}>
      <div className="lg:hidden space-y-3">
        {/* Title + Notification + Today picker */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <div className="flex items-center gap-2">
            <NotificationBell notifications={notifications} />
            <DateRangePicker />
          </div>
        </div>

        {/* 4-card quick-action row — HR shortcuts */}
        <div className="grid grid-cols-4 gap-2">
          <ActionCardLink
            icon={<Users className="h-4 w-4" />}
            label="Employees"
            href="/hr/employees"
          />
          <ActionCardLink
            icon={<CalendarClock className="h-4 w-4" />}
            label="Attendance"
            href="/hr/attendance"
          />
          <ActionCardLink
            icon={<CalendarDays className="h-4 w-4" />}
            label="Leave"
            href="/hr/leave"
          />
          <ActionCardLink
            icon={<Wallet className="h-4 w-4" />}
            label="Payroll"
            href="/hr/payroll"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

function cardClasses() {
  return "flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-3 text-foreground transition-colors active:bg-muted/40 hover:bg-muted/30";
}

function ActionCardLink({
  icon,
  label,
  href,
}: {
  icon: ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className={cardClasses()}>
      <span className="text-foreground">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
