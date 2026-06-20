"use client";

// Modern 12-hour time picker — a styled Popover with scrollable Hour / Minute
// columns and an AM/PM toggle, replacing the browser-native <input type="time">.
// Drop-in for forms: pass a `name` and it renders a hidden (focusable, sr-only)
// input carrying the canonical 24-hour `HH:mm` value, so server-action
// <form action> submits exactly as the native input did. Works controlled
// (`value` + `onChange`) or uncontrolled (`defaultValue`).
//
// The inner `TimeColumns` is exported so the DateTimePicker can embed the same
// hour/minute/meridiem UI without a nested popover.

import { useEffect, useId, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Meridiem = "AM" | "PM";

export const pad = (n: number) => String(n).padStart(2, "0");

export function parseTime(v: string | undefined) {
  if (!v)
    return { h12: null as number | null, m: null as number | null, mer: "AM" as Meridiem };
  const [hh, mm] = v.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm))
    return { h12: null as number | null, m: null as number | null, mer: "AM" as Meridiem };
  const mer: Meridiem = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return { h12, m: mm, mer };
}

export function buildTime(h12: number | null, m: number | null, mer: Meridiem): string {
  if (h12 == null || m == null) return "";
  const h24 = mer === "PM" ? (h12 % 12) + 12 : h12 % 12;
  return `${pad(h24)}:${pad(m)}`;
}

export function formatTimeLabel(value: string): string {
  const { h12, m, mer } = parseTime(value);
  if (h12 == null || m == null) return "";
  return `${h12}:${pad(m)} ${mer}`;
}

/** Hour / Minute / AM-PM selector body, reused by TimePicker and DateTimePicker.
 *  Flip-clock style: two big boxes (type a number, scroll the wheel, or press
 *  ↑/↓) with a colon between, and a stacked AM/PM toggle on the right. */
export function TimeColumns({
  value,
  onChange,
  minuteStep = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  minuteStep?: number;
}) {
  const { h12, m, mer } = parseTime(value);

  const setHour = (nh: number) =>
    onChange(buildTime(Math.min(12, Math.max(1, nh)), m ?? 0, mer));
  const setMinute = (nm: number) =>
    onChange(buildTime(h12 ?? 12, Math.min(59, Math.max(0, nm)), mer));
  const setMer = (nmer: Meridiem) => onChange(buildTime(h12 ?? 12, m ?? 0, nmer));

  // Steppers wrap around (12 → 1, 59 → 0) and respect the minute granularity.
  const stepHour = (d: number) => {
    const cur = h12 ?? 12;
    let n = cur + d;
    if (n > 12) n = 1;
    if (n < 1) n = 12;
    onChange(buildTime(n, m ?? 0, mer));
  };
  const stepMinute = (d: number) => {
    const cur = m ?? 0;
    const n = (((cur + d * minuteStep) % 60) + 60) % 60;
    onChange(buildTime(h12 ?? 12, n, mer));
  };

  return (
    <div className="flex items-start justify-center gap-1 p-2.5">
      <FlipField label="Hour" value={h12} min={1} max={12} onPick={setHour} onStep={stepHour} />
      <div className="flex h-11 items-center">
        <span className="text-lg font-semibold text-muted-foreground">:</span>
      </div>
      <FlipField label="Minute" value={m} min={0} max={59} pad onPick={setMinute} onStep={stepMinute} />
      {/* Stacked AM/PM segmented toggle — padded container with rounded inner
          segments so the active half reads as a pill, never clipped. */}
      <div className="ml-0.5 flex h-11 w-10 flex-col gap-1 rounded-lg border border-border bg-card/40 p-1">
        {(["AM", "PM"] as Meridiem[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setMer(opt)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md text-[11px] font-bold transition-colors",
              mer === opt
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export type TimePickerProps = {
  name?: string;
  id?: string;
  /** Controlled 24-hour value, `HH:mm`. */
  value?: string;
  /** Uncontrolled initial 24-hour value, `HH:mm`. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Minute granularity in the list (default 1). */
  minuteStep?: number;
};

export function TimePicker({
  name,
  id,
  value,
  defaultValue,
  onChange,
  placeholder = "Select time",
  required,
  disabled,
  className,
  minuteStep = 1,
}: TimePickerProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const commit = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const setNow = () => {
    const d = new Date();
    commit(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
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
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={current ? "" : "text-muted-foreground"}>
              {current ? formatTimeLabel(current) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          className="w-auto p-0"
        >
          <TimeColumns value={current} onChange={commit} minuteStep={minuteStep} />
          <div className="flex items-center justify-center gap-2 border-t border-border/60 p-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              onClick={setNow}
            >
              Now
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
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

/** One big flip-clock box: a typeable number with wheel + ↑/↓ stepping. The
 *  committed value comes from the parent; while focused we hold the raw text so
 *  partial typing isn't padded/clamped mid-keystroke. */
function FlipField({
  label,
  value,
  min,
  max,
  pad: doPad,
  onPick,
  onStep,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  pad?: boolean;
  onPick: (n: number) => void;
  onStep: (delta: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  // Mirror the committed value into the box whenever we're not mid-edit.
  useEffect(() => {
    if (!editing) {
      setText(value == null ? "" : doPad ? pad(value) : String(value));
    }
  }, [value, editing, doPad]);

  return (
    <div className="flex flex-col items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={text}
        placeholder="--"
        onFocus={(e) => {
          setEditing(true);
          setText(value == null ? "" : String(value));
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
          setText(digits);
          if (digits !== "") onPick(Math.min(max, parseInt(digits, 10)));
        }}
        onBlur={() => {
          setEditing(false);
          if (text !== "") onPick(Math.min(max, Math.max(min, parseInt(text, 10))));
        }}
        onWheel={(e) => {
          e.preventDefault();
          onStep(e.deltaY < 0 ? 1 : -1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onStep(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onStep(-1);
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="h-11 w-[62px] rounded-lg border-2 border-border bg-card/40 text-center text-xl font-semibold tabular-nums text-foreground caret-primary outline-none transition-colors focus:border-primary"
      />
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
