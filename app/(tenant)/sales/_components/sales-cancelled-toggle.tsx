"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Activity, History } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Sales History toggle. Lives in the TopBar between the notification
// bell and the New Sale (+) button. Toggling it on sets `history=1`
// in the URL, which SalesList watches to open the SalesHistoryDialog
// (a per-sale payment-bucket breakdown across the current filters).
//
// Icon swaps with state so the mode reads at a glance:
//   on  → History icon (history view open)
//   off → Activity icon (active list only)
export function SalesCancelledToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const checked = params.get("history") === "1";

  function setChecked(next: boolean) {
    const p = new URLSearchParams(params.toString());
    if (next) p.set("history", "1");
    else p.delete("history");
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3"
      title={
        checked
          ? "Sales history view open"
          : "Open the per-sale payment breakdown"
      }
    >
      <Switch
        id="topbar-sales-history"
        checked={checked}
        onCheckedChange={setChecked}
      />
      {checked ? (
        <History className="h-4 w-4 text-foreground" aria-hidden />
      ) : (
        <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
      <span className="sr-only">
        {checked ? "Sales history view open" : "Open sales history view"}
      </span>
    </div>
  );
}
