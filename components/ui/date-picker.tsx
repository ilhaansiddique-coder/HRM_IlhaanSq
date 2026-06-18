"use client";

// Modern single-date picker — a styled Popover + react-day-picker Calendar that
// replaces the browser-native <input type="date">. Drop-in for forms: pass a
// `name` and it renders a hidden (focusable, sr-only) input carrying the
// canonical `yyyy-MM-dd` value so server-action <form action> submits exactly
// as before. Works controlled (`value` + `onChange`) or uncontrolled
// (`defaultValue`). Mobile-safe, dark-mode aware, with optional Today/Clear
// quick actions.

import { useId, useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ISO = "yyyy-MM-dd";

function toDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = parse(v, ISO, new Date());
  return isValid(d) ? d : undefined;
}

export type DatePickerProps = {
  /** Hidden-input name so the value submits inside a <form action>. */
  name?: string;
  id?: string;
  /** Controlled value, `yyyy-MM-dd`. */
  value?: string;
  /** Uncontrolled initial value, `yyyy-MM-dd`. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Lower/upper selectable bounds, `yyyy-MM-dd`. */
  min?: string;
  max?: string;
  /** Show Today / Clear quick actions in the popover. */
  showPresets?: boolean;
  /**
   * Show month + year dropdowns instead of only prev/next arrows — set this for
   * birth dates / hire dates where you jump across many years. Provide the year
   * range with `fromYear` / `toYear`.
   */
  yearNavigation?: boolean;
  fromYear?: number;
  toYear?: number;
};

export function DatePicker({
  name,
  id,
  value,
  defaultValue,
  onChange,
  placeholder = "Select date",
  required,
  disabled,
  className,
  min,
  max,
  showPresets,
  yearNavigation,
  fromYear,
  toYear,
}: DatePickerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const selected = toDate(current);
  const minDate = useMemo(() => toDate(min), [min]);
  const maxDate = useMemo(() => toDate(max), [max]);
  const disabledMatchers = useMemo(() => {
    const m: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) m.push({ before: minDate });
    if (maxDate) m.push({ after: maxDate });
    return m.length ? m : undefined;
  }, [minDate, maxDate]);

  const commit = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const pick = (d: Date | undefined) => {
    commit(d ? format(d, ISO) : "");
    setOpen(false);
  };

  return (
    <>
      {name && (
        <input
          type="text"
          name={name}
          id={fieldId}
          value={current}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          className="sr-only"
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 px-3 text-sm font-normal",
              className
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={selected ? "" : "text-muted-foreground"}>
              {selected ? format(selected, "MMM d, yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          className="!w-fit !max-w-[calc(100vw-1rem)] p-0"
        >
          <Calendar
            mode="single"
            // Match the range-picker format: week starts Monday.
            weekStartsOn={1}
            selected={selected}
            onSelect={pick}
            defaultMonth={selected ?? minDate ?? new Date()}
            disabled={disabledMatchers}
            captionLayout={yearNavigation ? "dropdown-buttons" : "buttons"}
            fromYear={yearNavigation ? fromYear ?? 1940 : undefined}
            toYear={yearNavigation ? toYear ?? new Date().getFullYear() + 1 : undefined}
            // Styling mirrors app/(tenant)/_components/date-range-picker.tsx so
            // every single-date field shares the same calendar look: uppercase
            // weekday heads, rounded-full day cells, ringed "today", solid-primary
            // selected day.
            classNames={{
              caption: "relative flex items-center justify-center pt-1 pb-2",
              caption_label: yearNavigation ? "hidden" : "text-sm font-semibold",
              nav_button:
                "inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground opacity-70 transition-colors hover:bg-muted hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              head_cell: "text-[10px] font-normal uppercase text-muted-foreground",
              cell: "h-9 w-9 p-0 text-center text-xs relative",
              day: "inline-flex h-8 w-8 mx-auto items-center justify-center rounded-full p-0 text-xs font-normal text-foreground transition-colors hover:bg-muted aria-selected:opacity-100",
              day_selected:
                "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "ring-1 ring-primary/50",
              day_outside: "text-muted-foreground/40",
              day_disabled: "text-muted-foreground/30",
              day_hidden: "invisible",
              ...(yearNavigation
                ? {
                    caption_dropdowns: "flex items-center justify-center gap-1.5",
                    vhidden: "sr-only",
                    dropdown:
                      "rounded-md border border-input bg-background px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    dropdown_month: "relative",
                    dropdown_year: "relative",
                  }
                : {}),
            }}
            showOutsideDays
            className="p-3"
          />
          {showPresets && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2.5">
              <button
                type="button"
                className="rounded-[100px] bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                onClick={() => pick(undefined)}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-[100px] bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                onClick={() => pick(new Date())}
              >
                Today
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
