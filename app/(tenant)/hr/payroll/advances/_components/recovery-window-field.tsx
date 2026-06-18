"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";

// Optional advance-recovery window — two single-date pickers ("From date" /
// "To date"). The advance is recovered only on payroll runs whose pay period
// falls within that range; installment = amount ÷ months in the range. Each
// DatePicker submits its own hidden input (`recoveryStart` / `recoveryEnd`,
// yyyy-MM-dd) so the parent <form action> picks them up. Both blank = no window
// (default "from the month after issue" rule).
export function RecoveryWindowField() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">From date</span>
          <DatePicker
            name="recoveryStart"
            value={from}
            placeholder="Start…"
            onChange={(d) => {
              setFrom(d);
              // Keep the window valid: clear an end date that's now before start.
              if (d && to && to < d) setTo("");
            }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">To date</span>
          <DatePicker
            name="recoveryEnd"
            value={to}
            placeholder="End…"
            onChange={setTo}
            min={from || undefined}
          />
        </div>
      </div>
      {(from || to) && (
        <button
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear recovery period
        </button>
      )}
    </div>
  );
}
