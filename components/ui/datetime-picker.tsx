"use client";

// Modern date + time picker — a single styled Popover containing the calendar
// and the 12-hour time columns, replacing the browser-native
// <input type="datetime-local">. Drop-in for forms: pass a `name` and it renders
// a hidden (focusable, sr-only) input carrying the canonical local
// `yyyy-MM-ddTHH:mm` value (exactly what datetime-local submits). Works
// controlled (`value` + `onChange`) or uncontrolled (`defaultValue`).

import { useId, useState } from "react";
import { CalendarClock } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimeColumns, formatTimeLabel, pad } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

const DATE = "yyyy-MM-dd";

function splitValue(v: string | undefined): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  const [date, time] = v.split("T");
  return { date: date ?? "", time: (time ?? "").slice(0, 5) };
}

function joinValue(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

function toDate(date: string): Date | undefined {
  if (!date) return undefined;
  const d = parse(date, DATE, new Date());
  return isValid(d) ? d : undefined;
}

export type DateTimePickerProps = {
  name?: string;
  id?: string;
  /** Controlled value, `yyyy-MM-ddTHH:mm`. */
  value?: string;
  /** Uncontrolled initial value, `yyyy-MM-ddTHH:mm`. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  minuteStep?: number;
};

export function DateTimePicker({
  name,
  id,
  value,
  defaultValue,
  onChange,
  placeholder = "Select date & time",
  required,
  disabled,
  className,
  minuteStep = 1,
}: DateTimePickerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const { date, time } = splitValue(current);
  const selectedDate = toDate(date);

  const commit = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const pickDate = (d: Date | undefined) =>
    commit(joinValue(d ? format(d, DATE) : "", time));
  const pickTime = (t: string) => commit(joinValue(date, t));

  const triggerLabel = () => {
    if (!date) return placeholder;
    const dateLabel = selectedDate ? format(selectedDate, "MMM d, yyyy") : date;
    const timeLabel = time ? formatTimeLabel(time) : "";
    return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
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
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={date ? "" : "text-muted-foreground"}>
              {triggerLabel()}
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
          <div className="flex flex-col sm:flex-row sm:items-start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={pickDate}
              defaultMonth={selectedDate ?? new Date()}
              showOutsideDays
              className="p-3"
            />
            <div className="border-t border-border/60 sm:border-l sm:border-t-0">
              <TimeColumns value={time} onChange={pickTime} minuteStep={minuteStep} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                const d = new Date();
                commit(`${format(d, DATE)}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
              }}
            >
              Now
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
