"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "../../dashboard/_components/date-range-picker";

// Slotted into the desktop TopBar for /invoices via tenant-shell.tsx.
// Mirrors the SalesHeaderControls pattern: search + DateRangePicker,
// both URL-driven so back/forward and shareable links keep the view.
//
// URL params it writes:
//   q       — search string (debounced 250ms while typing)
//   range   — date preset key (today, last_7_days, last_30_days, …)
//   from/to — YYYY-MM-DD custom range (set by DateRangePicker, mutually
//             exclusive with `range`)
export function InvoicesHeaderControls() {
  const router = useRouter();
  const params = useSearchParams();

  const urlQ = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(urlQ);

  // Hydrate the buffer from the URL on mount + when the URL changes
  // externally (browser back/forward, in-page mobile search field).
  useEffect(() => setSearchInput(urlQ), [urlQ]);

  // Debounce-write the buffer back to the URL.
  useEffect(() => {
    if (searchInput === urlQ) return;
    const id = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (searchInput) p.set("q", searchInput);
      else p.delete("q");
      router.replace(`?${p.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, urlQ]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
        />
        <Input
          type="text"
          placeholder="Search invoices by number..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          // Match the rest of the TopBar pill borders (Today / Bell /
          // Plus / Theme / User) — they all use border-border/60 +
          // bg-background/80. Default Input uses border-input which is
          // a slightly different theme color.
          className="h-9 w-72 rounded-lg border-border/60 bg-background/80 pl-9"
        />
      </div>

      {/* Default to "today" so the page lands on today's invoices —
          matches the convention the /sales TopBar uses. */}
      <DateRangePicker defaultPreset="today" />
    </div>
  );
}
