"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";

// URL-driven Cancelled-rows toggle. Lives in the TopBar between the
// notification bell and the New Sale (+) button. The presence of the
// `cancelled=1` query param (mirrored back to SalesList) means
// cancelled sales are visible; absent means hidden.
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
      title="Show cancelled sales"
    >
      <Switch
        id="topbar-show-cancelled"
        checked={checked}
        onCheckedChange={setChecked}
      />
      <label
        htmlFor="topbar-show-cancelled"
        className="select-none text-xs text-muted-foreground"
      >
        Cancelled
      </label>
    </div>
  );
}
