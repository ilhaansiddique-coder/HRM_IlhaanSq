"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, X } from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DateRangePresetKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "last_month"
  | "all_time";

type PresetKey = DateRangePresetKey;

type Preset = {
  key: PresetKey;
  label: string;
  getRange: () => { from: Date; to: Date };
};

// Order + labels mirror the design: Today, Yesterday, Last 7/30/90 days,
// This Month, Last Month, All Time. Server-side equivalents live in
// lib/date-range.ts (PRESET_BUILDERS) and must stay in sync.
export const DATE_RANGE_PRESETS: Preset[] = [
  {
    key: "today",
    label: "Today",
    getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  },
  {
    key: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const y = subDays(new Date(), 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
  {
    key: "last_7_days",
    label: "Last 7 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    key: "last_30_days",
    label: "Last 30 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    key: "last_90_days",
    label: "Last 90 days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 89)),
      to: endOfDay(new Date()),
    }),
  },
  {
    key: "this_month",
    label: "This Month",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    key: "last_month",
    label: "Last Month",
    getRange: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    },
  },
  {
    key: "all_time",
    label: "All Time",
    getRange: () => ({
      from: new Date(2000, 0, 1),
      to: endOfDay(new Date()),
    }),
  },
];

function fmtDateISO(d: Date | undefined): string | null {
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function matchPreset(range: DateRange | undefined): PresetKey | null {
  if (!range?.from || !range?.to) return null;
  for (const p of DATE_RANGE_PRESETS) {
    const r = p.getRange();
    if (isSameDay(r.from, range.from) && isSameDay(r.to, range.to)) {
      return p.key;
    }
  }
  return null;
}

function triggerLabel(
  range: DateRange | undefined,
  preset: PresetKey | null
): string {
  const activePreset = preset
    ? DATE_RANGE_PRESETS.find((p) => p.key === preset)
    : matchPreset(range)
      ? DATE_RANGE_PRESETS.find((p) => p.key === matchPreset(range))
      : null;
  if (activePreset) return activePreset.label;
  if (range?.from && range?.to) {
    if (isSameDay(range.from, range.to)) return format(range.from, "MMM d, yyyy");
    return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`;
  }
  return "All Time";
}

export function DateRangePicker({
  // Preset that represents "no filter applied" for the host page. Pages read
  // the same URL params with this fallback, so empty URL === this view.
  defaultPreset = "all_time",
}: {
  defaultPreset?: PresetKey;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  // Committed state (from URL)
  const committed = useMemo<{ range: DateRange; preset: PresetKey | null }>(() => {
    const rangeParam = params.get("range") as PresetKey | null;
    const fromParam = parseDateParam(params.get("from"));
    const toParam = parseDateParam(params.get("to"));

    if (rangeParam) {
      const preset = DATE_RANGE_PRESETS.find((p) => p.key === rangeParam);
      if (preset) return { range: preset.getRange(), preset: preset.key };
    }
    if (fromParam && toParam) {
      return { range: { from: fromParam, to: toParam }, preset: null };
    }
    const fallback =
      DATE_RANGE_PRESETS.find((p) => p.key === defaultPreset) ??
      DATE_RANGE_PRESETS[0];
    return { range: fallback.getRange(), preset: fallback.key };
  }, [params, defaultPreset]);

  // Staged (draft) state while popover is open
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    committed.range
  );
  const [draftPreset, setDraftPreset] = useState<PresetKey | null>(
    committed.preset
  );

  useEffect(() => {
    if (open) {
      setDraftRange(committed.range);
      setDraftPreset(committed.preset);
    }
  }, [open, committed]);

  function applyPreset(p: Preset) {
    setDraftRange(p.getRange());
    setDraftPreset(p.key);
  }

  function onCalendarSelect(r: DateRange | undefined) {
    setDraftRange(r);
    setDraftPreset(r ? matchPreset(r) : null);
  }

  // Push a range to the URL. `preset`/`range` come from the draft (Done) or
  // are cleared to the default (Reset / chip ✕).
  function pushToUrl(preset: PresetKey | null, range: DateRange | undefined) {
    const next = new URLSearchParams(params.toString());
    next.delete("range");
    next.delete("from");
    next.delete("to");

    if (preset) {
      if (preset !== defaultPreset) next.set("range", preset);
    } else if (range?.from && range?.to) {
      next.set("from", fmtDateISO(range.from)!);
      next.set("to", fmtDateISO(range.to)!);
    }

    const query = next.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`);
  }

  function done() {
    pushToUrl(draftPreset, draftRange);
    setOpen(false);
  }

  // Reset clears back to the page default (no filter) and applies immediately.
  function reset() {
    const fallback =
      DATE_RANGE_PRESETS.find((p) => p.key === defaultPreset) ??
      DATE_RANGE_PRESETS[0];
    setDraftPreset(fallback.key);
    setDraftRange(fallback.getRange());
    pushToUrl(fallback.key, fallback.getRange());
    setOpen(false);
  }

  const label = triggerLabel(committed.range, committed.preset);
  // A filter is "active" (shows the clear ✕) when it isn't the default view.
  const isFiltered = committed.preset !== defaultPreset || committed.preset === null;

  const draftSummary =
    draftRange?.from && draftRange?.to
      ? `${format(draftRange.from, "MMM d")} — ${format(draftRange.to, "MMM d")}`
      : "Select a range";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`h-10 gap-2 border-border/60 bg-card/40 px-3 font-medium ${
              isFiltered ? "rounded-l-full rounded-r-none border-r-0" : "rounded-full"
            }`}
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>{label}</span>
          </Button>
        </PopoverTrigger>
        {/* Clear chip — only when a non-default filter is active */}
        {isFiltered && (
          <button
            type="button"
            aria-label="Clear date filter"
            title="Clear date filter"
            onClick={reset}
            className="flex h-10 items-center rounded-r-full border border-l-0 border-border/60 bg-card/40 px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="!w-[640px] !max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-2xl shadow-black/10"
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold">Select Date</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col lg:h-[356px] lg:flex-row">
          {/* Quick-select sidebar */}
          <div className="overflow-y-auto p-3 lg:w-32 lg:shrink-0 lg:space-y-1 lg:border-r lg:border-border lg:bg-muted/40">
            <p className="mb-2 hidden px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground lg:block">
              Quick select
            </p>
            <div className="flex flex-row gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
              {DATE_RANGE_PRESETS.map((p) => {
                const active = draftPreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`shrink-0 whitespace-nowrap rounded-[100px] px-3 py-2 text-[13px] font-medium transition-all duration-150 lg:w-full lg:shrink lg:whitespace-normal lg:px-2.5 lg:text-left lg:text-xs ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-foreground hover:bg-background hover:shadow-sm lg:bg-transparent"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar + footer */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-1 overflow-hidden">
            <Calendar
              mode="range"
              weekStartsOn={1}
              selected={draftPreset === "all_time" ? undefined : draftRange}
              onSelect={onCalendarSelect}
              numberOfMonths={2}
              defaultMonth={
                draftPreset === "all_time" || !draftRange?.from
                  ? subMonths(new Date(), 1)
                  : draftRange.from
              }
              showOutsideDays
              className="w-full h-full p-2"
              classNames={{
                caption_label: "text-sm font-semibold",
                caption: "dp-caption relative flex items-center pt-[20px] pb-[30px]",
                nav_button:
                  "inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground opacity-70 transition-colors hover:bg-muted hover:opacity-100",
                months:
                  "flex h-full flex-col gap-3 divide-border sm:flex-row sm:gap-0 sm:divide-x [&>*:first-child_.dp-caption]:justify-end [&>*:last-child_.dp-caption]:justify-start",
                month: "flex h-full flex-col gap-0 sm:px-4",
                table:
                  "mx-auto w-[205px] flex-1 border-collapse table-fixed",
                head_cell:
                  "text-[10px] font-normal uppercase text-muted-foreground",
                cell: "h-9 p-0 text-center text-xs relative",
                day: "inline-flex h-7 w-7 mx-auto items-center justify-center rounded-full p-0 text-xs font-normal text-foreground transition-colors hover:bg-muted aria-selected:opacity-100",
                day_selected:
                  "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "ring-1 ring-primary/50",
                day_range_middle:
                  "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_outside:
                  "text-muted-foreground/40 aria-selected:bg-accent/40 aria-selected:text-muted-foreground",
                day_disabled: "text-muted-foreground/30",
                day_hidden: "invisible",
              }}
            />
            </div>
            <div className="flex flex-col items-start justify-between gap-2 border-t border-border px-3 py-3 sm:flex-row sm:items-center">
              <span className="text-xs text-muted-foreground">{draftSummary}</span>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-[100px] bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 sm:flex-none sm:py-1.5"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={done}
                  disabled={
                    draftPreset !== "all_time" &&
                    (!draftRange?.from || !draftRange?.to)
                  }
                  className="flex-1 rounded-[100px] bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:py-1.5"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}