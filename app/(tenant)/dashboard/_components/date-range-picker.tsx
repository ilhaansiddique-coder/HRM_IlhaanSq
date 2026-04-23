"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfYear,
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

type PresetKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_month"
  | "last_30_days"
  | "this_year"
  | "all_time";

type Preset = {
  key: PresetKey;
  label: string;
  getRange: () => { from: Date; to: Date };
};

const PRESETS: Preset[] = [
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
    key: "this_month",
    label: "This Month",
    getRange: () => ({
      from: startOfMonth(new Date()),
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
    key: "this_year",
    label: "This Year",
    getRange: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }),
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
  for (const p of PRESETS) {
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
    ? PRESETS.find((p) => p.key === preset)
    : matchPreset(range)
      ? PRESETS.find((p) => p.key === matchPreset(range))
      : null;
  if (activePreset) return activePreset.label;
  if (range?.from && range?.to) {
    if (isSameDay(range.from, range.to)) return format(range.from, "MMM d, yyyy");
    return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`;
  }
  return "Today";
}

export function DateRangePicker() {
  const router = useRouter();
  const params = useSearchParams();

  // Committed state (from URL)
  const committed = useMemo<{ range: DateRange; preset: PresetKey | null }>(() => {
    const rangeParam = params.get("range") as PresetKey | null;
    const fromParam = parseDateParam(params.get("from"));
    const toParam = parseDateParam(params.get("to"));

    if (rangeParam) {
      const preset = PRESETS.find((p) => p.key === rangeParam);
      if (preset) return { range: preset.getRange(), preset: preset.key };
    }
    if (fromParam && toParam) {
      return { range: { from: fromParam, to: toParam }, preset: null };
    }
    // default
    const today = PRESETS[0].getRange();
    return { range: today, preset: "today" };
  }, [params]);

  // Staged (draft) state while popover is open
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    committed.range
  );
  const [draftPreset, setDraftPreset] = useState<PresetKey | null>(
    committed.preset
  );

  // Reset draft whenever URL changes or popover opens
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

  function commit() {
    const next = new URLSearchParams(params.toString());
    next.delete("range");
    next.delete("from");
    next.delete("to");

    if (draftPreset) {
      if (draftPreset !== "today") next.set("range", draftPreset);
    } else if (draftRange?.from && draftRange?.to) {
      next.set("from", fmtDateISO(draftRange.from)!);
      next.set("to", fmtDateISO(draftRange.to)!);
    }

    const query = next.toString();
    router.push(`/dashboard${query ? `?${query}` : ""}`);
    setOpen(false);
  }

  function cancel() {
    setDraftRange(committed.range);
    setDraftPreset(committed.preset);
    setOpen(false);
  }

  const label = triggerLabel(committed.range, committed.preset);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-lg border-border/60 bg-card/40 px-3 font-medium"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="!w-fit !max-w-[calc(100vw-1rem)] p-0"
      >
        <div className="flex flex-col md:flex-row">
          {/* Presets */}
          <div className="w-full border-b border-border/60 p-3 md:w-44 md:shrink-0 md:border-b-0 md:border-r">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Presets
            </p>
            <div className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {PRESETS.map((p) => {
                const active = draftPreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm text-left transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar + actions */}
          <div className="min-w-0 flex-1">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={onCalendarSelect}
              numberOfMonths={2}
              defaultMonth={draftRange?.from ?? subMonths(new Date(), 1)}
              showOutsideDays
              className="p-3"
            />
            <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={commit}
                disabled={!draftRange?.from || !draftRange?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
