"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Optional advance-recovery window — split into two single-date pickers
// ("From date" / "To date"). The advance is recovered only on payroll runs
// whose pay period falls within that range; installment = amount ÷ months in
// the range. Submits `recoveryStart` / `recoveryEnd` (yyyy-MM-dd) via hidden
// inputs so the parent <form action> picks them up. Both blank = no window
// (default "from the month after issue" rule). Responsive: single-month
// calendar, viewport-safe popover.
function DatePicker({
  value,
  onChange,
  placeholder,
  disabledBefore,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder: string;
  disabledBefore?: Date;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-start gap-2 px-3 text-sm font-normal"
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={value ? "" : "text-muted-foreground"}>
            {value ? format(value, "MMM d, yyyy") : placeholder}
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
          selected={value}
          onSelect={(d) => {
            onChange(d ?? undefined);
            setOpen(false);
          }}
          defaultMonth={value ?? disabledBefore ?? new Date()}
          disabled={disabledBefore ? { before: disabledBefore } : undefined}
          showOutsideDays
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

export function RecoveryWindowField() {
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const iso = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : "");

  return (
    <div className="space-y-1.5">
      <input type="hidden" name="recoveryStart" value={iso(from)} />
      <input type="hidden" name="recoveryEnd" value={iso(to)} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">From date</span>
          <DatePicker
            value={from}
            placeholder="Start…"
            onChange={(d) => {
              setFrom(d);
              // Keep the window valid: clear an end date that's now before start.
              if (d && to && to < d) setTo(undefined);
            }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">To date</span>
          <DatePicker
            value={to}
            placeholder="End…"
            onChange={setTo}
            disabledBefore={from}
          />
        </div>
      </div>
      {(from || to) && (
        <button
          type="button"
          onClick={() => {
            setFrom(undefined);
            setTo(undefined);
          }}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear recovery period
        </button>
      )}
    </div>
  );
}
