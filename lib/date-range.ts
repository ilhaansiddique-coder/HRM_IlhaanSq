// Server-friendly date-range helpers used by reports + export routes.
// Mirrors the preset semantics of `DATE_RANGE_PRESETS` in
// app/(tenant)/dashboard/_components/date-range-picker.tsx so the URL
// (`?range=...` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`) round-trips
// identically between the client picker and any server consumer.

import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";

export type DateRangePresetKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_month"
  | "last_30_days"
  | "this_year"
  | "all_time";

export type DateBounds = { start: Date | null; end: Date | null };

const PRESET_BUILDERS: Record<DateRangePresetKey, () => DateBounds> = {
  today: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }),
  yesterday: () => {
    const y = subDays(new Date(), 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  },
  last_7_days: () => ({
    start: startOfDay(subDays(new Date(), 6)),
    end: endOfDay(new Date()),
  }),
  this_month: () => ({
    start: startOfMonth(new Date()),
    end: endOfDay(new Date()),
  }),
  last_30_days: () => ({
    start: startOfDay(subDays(new Date(), 29)),
    end: endOfDay(new Date()),
  }),
  this_year: () => ({
    start: startOfYear(new Date()),
    end: endOfDay(new Date()),
  }),
  // Sentinel "no upper bound" — leave both null so callers can skip
  // the createdAt filter entirely on aggregations.
  all_time: () => ({ start: null, end: null }),
};

function parseISODate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveDateBounds(
  rangeParam: string | null | undefined,
  fromParam: string | null | undefined,
  toParam: string | null | undefined,
  fallbackPreset: DateRangePresetKey = "today"
): DateBounds {
  if (rangeParam && rangeParam in PRESET_BUILDERS) {
    return PRESET_BUILDERS[rangeParam as DateRangePresetKey]();
  }
  const from = parseISODate(fromParam);
  const to = parseISODate(toParam);
  if (from && to) {
    return { start: startOfDay(from), end: endOfDay(to) };
  }
  return PRESET_BUILDERS[fallbackPreset]();
}

export function formatDateLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) return "All time";
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  if (sameDay) return start.toLocaleDateString(undefined, opts);
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}
