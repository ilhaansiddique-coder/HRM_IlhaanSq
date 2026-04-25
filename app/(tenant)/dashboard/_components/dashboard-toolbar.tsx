"use client";

import { DateRangePicker } from "./date-range-picker";

// Quick-shortcut icons (cart, reports, customers, +) and the user/theme/
// sign-out controls now live in the global TopBar inside tenant-shell.tsx.
// This page-level toolbar is just the date range picker.
export function DashboardToolbar() {
  return (
    <div className="flex items-center justify-start gap-2">
      <DateRangePicker />
    </div>
  );
}
