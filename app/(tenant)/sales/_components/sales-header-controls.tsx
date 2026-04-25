"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ListFilter, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSalesCreators } from "../actions";
import { DateRangePicker } from "../../dashboard/_components/date-range-picker";

// URL params (kept identical to what SalesList reads):
//   q       — search
//   range   — date preset key (today, yesterday, last_7_days, …, all_time);
//             omitted when "all_time" since that's the host default
//   from/to — YYYY-MM-DD (custom calendar range; mutually exclusive with range)
//   status  — comma-separated payment status keys
//   terms   — comma-separated payment term keys
//   courier — comma-separated courier status keys
//   user    — created-by user id

const STATUS_KEYS = ["paid", "partial", "pending", "cancelled"] as const;
const TERMS_KEYS = ["immediate", "cod", "credit"] as const;
const COURIER_KEYS = [
  "not_sent",
  "pending",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
  "lost",
] as const;

const parseSet = (raw: string | null): Set<string> =>
  new Set((raw ?? "").split(",").filter(Boolean));

const setToParam = (s: Set<string>): string =>
  Array.from(s).filter(Boolean).join(",");

export function SalesHeaderControls() {
  const router = useRouter();
  const params = useSearchParams();

  const urlQ = params.get("q") ?? "";
  const urlStatuses = useMemo(() => parseSet(params.get("status")), [params]);
  const urlTerms = useMemo(() => parseSet(params.get("terms")), [params]);
  const urlCouriers = useMemo(() => parseSet(params.get("courier")), [params]);
  const urlUser = params.get("user") ?? "";

  // Local input buffer — debounced into the URL so typing stays instant.
  const [searchInput, setSearchInput] = useState(urlQ);
  useEffect(() => setSearchInput(urlQ), [urlQ]);
  useEffect(() => {
    if (searchInput === urlQ) return;
    const id = setTimeout(() => {
      writeParam("q", searchInput);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, urlQ]);

  // Helper to write a single param (or a clear).
  function writeParam(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  function writeMany(patch: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  function toggleInUrlSet(key: "status" | "terms" | "courier", value: string) {
    const current = parseSet(params.get(key));
    if (current.has(value)) current.delete(value);
    else current.add(value);
    writeParam(key, setToParam(current));
  }

  function clearAllFilters() {
    writeMany({ status: "", terms: "", courier: "" });
  }

  const activeFilterCount =
    urlStatuses.size + urlTerms.size + urlCouriers.size;

  // "All Users" dropdown — fetched the first time the popover opens.
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [usersLoading, setUsersLoading] = useState(false);
  function loadUsers() {
    if (users || usersLoading) return;
    setUsersLoading(true);
    getSalesCreators()
      .then((u) => setUsers(u))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }
  const userLabel =
    !urlUser
      ? "All Users"
      : users?.find((u) => u.id === urlUser)?.name ?? "User";

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-foreground/60"
        />
        <Input
          type="text"
          placeholder="Search invoice, customer..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-72 rounded-lg pl-9"
        />
      </div>

      {/* Shared date range picker (presets sidebar + dual-month
          calendar). Default "all_time" so /sales loads unfiltered;
          the picker writes `range`, `from`, `to` query params. */}
      <DateRangePicker defaultPreset="all_time" />

      {/* All Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 rounded-lg font-normal">
            <ListFilter className="h-4 w-4" />
            <span className="text-sm">All Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-semibold leading-tight text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3 p-3">
          <FilterGroup label="Payment Status">
            {STATUS_KEYS.map((k) => (
              <Chip
                key={k}
                active={urlStatuses.has(k)}
                onClick={() => toggleInUrlSet("status", k)}
              >
                {k}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Payment Terms">
            {TERMS_KEYS.map((k) => (
              <Chip
                key={k}
                active={urlTerms.has(k)}
                onClick={() => toggleInUrlSet("terms", k)}
              >
                {k}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Courier">
            {COURIER_KEYS.map((k) => (
              <Chip
                key={k}
                active={urlCouriers.has(k)}
                onClick={() => toggleInUrlSet("courier", k)}
              >
                {k.replace("_", " ")}
              </Chip>
            ))}
          </FilterGroup>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={clearAllFilters}
            >
              Clear all filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* All Users */}
      <Popover onOpenChange={(o) => o && loadUsers()}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 rounded-lg font-normal">
            <User className="h-4 w-4" />
            <span className="text-sm">{userLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          <Button
            variant={urlUser === "" ? "default" : "ghost"}
            size="sm"
            className="w-full justify-start rounded-md"
            onClick={() => writeParam("user", "")}
          >
            All Users
          </Button>
          {usersLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : !users || users.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No creators on record
            </p>
          ) : (
            users.map((u) => (
              <Button
                key={u.id}
                variant={urlUser === u.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start rounded-md"
                onClick={() => writeParam("user", u.id)}
              >
                {u.name}
              </Button>
            ))
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-xs capitalize transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
