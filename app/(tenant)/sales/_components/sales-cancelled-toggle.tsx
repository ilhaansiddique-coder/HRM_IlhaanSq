"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Activity, History } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// URL-driven sales history toggle. Lives in the TopBar between the
// notification bell and the New Sale (+) button. The presence of the
// `cancelled=1` query param (mirrored back to SalesList) means
// cancelled sales are visible; absent means hidden.
//
// The trailing icon swaps with state so a glance reveals which mode
// the list is in:
//   on  → History icon (full history visible, including cancelled)
//   off → Activity icon (active sales only)
export function SalesCancelledToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const checked = params.get("cancelled") === "1";

  function setChecked(next: boolean) {
    const p = new URLSearchParams(params.toString());
    if (next) p.set("cancelled", "1");
    else p.delete("cancelled");
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3"
      title={
        checked
          ? "Showing full sales history (including cancelled)"
          : "Showing active sales only"
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
        {checked
          ? "Showing full sales history"
          : "Showing active sales only"}
      </span>
    </div>
  );
}
