"use client";

import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ListFilter,
  Plus,
  Rows3,
  Search,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "../../dashboard/_components/date-range-picker";

export type StatusKey = "paid" | "partial" | "pending" | "cancelled";
export type TermsKey = "immediate" | "cod" | "credit";
export type CourierKey =
  | "not_sent"
  | "pending"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled"
  | "lost";

export type Density = "comfortable" | "compact";

// `datePreset` / `startDate` / `endDate` were retired when the shared
// DateRangePicker (which writes `range`/`from`/`to` directly to the
// URL) replaced the inline date Popover. SalesList still drives those
// query params; the toolbar no longer participates in the date state.
export type ToolbarFilters = {
  search: string;
  statuses: Set<StatusKey>;
  terms: Set<TermsKey>;
  couriers: Set<CourierKey>;
  userId: string; // "" = all
  showCancelled: boolean;
  density: Density;
};

export function SalesToolbar({
  filters,
  onChange,
  users,
  alertCount,
  onAlertClick,
  onNewSale,
}: {
  filters: ToolbarFilters;
  onChange: (next: ToolbarFilters) => void;
  users: { id: string; name: string }[];
  alertCount: number;
  onAlertClick: () => void;
  onNewSale: () => void;
}) {
  const set = <K extends keyof ToolbarFilters>(key: K, value: ToolbarFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleInSet = <T,>(s: Set<T>, v: T): Set<T> => {
    const next = new Set(s);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const activeFilterCount =
    filters.statuses.size + filters.terms.size + filters.couriers.size;

  const userLabel = useMemo(() => {
    if (!filters.userId) return "All Users";
    const u = users.find((x) => x.id === filters.userId);
    return u ? u.name : "Unknown user";
  }, [filters.userId, users]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search + Date + All Filters + All Users.
          On desktop these live in the TopBar (SalesHeaderControls) so
          we hide this block above md to avoid duplication. URL params
          keep both copies in sync. */}
      <div className="contents md:hidden">
      {/* Search */}
      <div className="relative min-w-[180px] flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Search invoice, customer..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="h-9 pl-9 rounded-full"
        />
      </div>

      {/* Shared date range picker — same component the dashboard /
          TopBar uses. Writes `range` / `from` / `to` to the URL. */}
      <DateRangePicker defaultPreset="today" />

      {/* All Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 rounded-full font-normal">
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
        <PopoverContent align="start" className="w-72 p-3 space-y-3">
          <FilterGroup label="Payment Status">
            {(["paid", "partial", "pending", "cancelled"] as StatusKey[]).map((k) => (
              <Chip
                key={k}
                active={filters.statuses.has(k)}
                onClick={() =>
                  set("statuses", toggleInSet(filters.statuses, k))
                }
              >
                {k}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Payment Terms">
            {(["immediate", "cod", "credit"] as TermsKey[]).map((k) => (
              <Chip
                key={k}
                active={filters.terms.has(k)}
                onClick={() => set("terms", toggleInSet(filters.terms, k))}
              >
                {k}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Courier">
            {(
              [
                "not_sent",
                "pending",
                "in_transit",
                "delivered",
                "returned",
                "cancelled",
                "lost",
              ] as CourierKey[]
            ).map((k) => (
              <Chip
                key={k}
                active={filters.couriers.has(k)}
                onClick={() =>
                  set("couriers", toggleInSet(filters.couriers, k))
                }
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
              onClick={() =>
                onChange({
                  ...filters,
                  statuses: new Set(),
                  terms: new Set(),
                  couriers: new Set(),
                })
              }
            >
              Clear all filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* All Users */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 rounded-full font-normal">
            <User className="h-4 w-4" />
            <span className="text-sm">{userLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          <Button
            variant={filters.userId === "" ? "default" : "ghost"}
            size="sm"
            className="w-full justify-start rounded-full"
            onClick={() => set("userId", "")}
          >
            All Users
          </Button>
          {users.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No creators on record
            </p>
          ) : (
            users.map((u) => (
              <Button
                key={u.id}
                variant={filters.userId === u.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start rounded-full"
                onClick={() => set("userId", u.id)}
              >
                {u.name}
              </Button>
            ))
          )}
        </PopoverContent>
      </Popover>

      </div>
      {/* End mobile-only shared filters wrapper. */}

      {/* Right cluster — always visible. */}
      <div className="ml-auto flex items-center gap-2">
        {/* Alert / outstanding */}
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          onClick={onAlertClick}
          aria-label={`${alertCount} outstanding sales`}
          disabled={alertCount === 0}
        >
          <AlertTriangle
            className={`h-4 w-4 ${alertCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
          />
          {alertCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-tight text-destructive-foreground">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </Button>

        {/* Density toggle */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() =>
            set(
              "density",
              filters.density === "comfortable" ? "compact" : "comfortable"
            )
          }
          aria-label={`Switch to ${filters.density === "comfortable" ? "compact" : "comfortable"} rows`}
          title={`Density: ${filters.density}`}
        >
          <Rows3 className="h-4 w-4" />
        </Button>

        {/* New sale */}
        <Button
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={onNewSale}
          aria-label="New sale"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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
  children: ReactNode;
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
