"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "../../dashboard/_components/date-range-picker";

// Slotted into the TopBar's left cluster on /customers. Two URL-driven
// controls so the inline list (CustomerList) stays in sync without
// any cross-component state plumbing:
//   • Search input → writes `q`, debounced 200ms.
//   • Date range  → DateRangePicker writes `range` (preset) or
//                   `from` / `to` (custom). Defaults to "all_time"
//                   so the empty-URL state matches the trigger label
//                   "All Time" without writing the param.
export function CustomersHeaderControls() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";

  const [searchInput, setSearchInput] = useState(urlQ);

  // Mirror URL → input when other code (or back/forward) changes it,
  // so two open tabs / cross-component edits stay in sync.
  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  // Mirror input → URL on a debounce so router.replace doesn't fire
  // on every keystroke.
  useEffect(() => {
    if (searchInput === urlQ) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (searchInput) next.set("q", searchInput);
      else next.delete("q");
      router.replace(`?${next.toString()}`, { scroll: false });
    }, 200);
    return () => clearTimeout(id);
  }, [searchInput, urlQ, params, router]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
        />
        <Input
          type="text"
          placeholder="Search customers, phone, WhatsApp, or notes..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-72 rounded-lg pl-9"
        />
      </div>
      <DateRangePicker defaultPreset="all_time" />
    </div>
  );
}
