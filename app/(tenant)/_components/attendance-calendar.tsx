"use client";

import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";

type Rec = {
  date: string; // ISO
  status: string; // present | late | absent | ...
  isHoliday?: boolean;
  checkIn?: string | null;
};

// Read-only month calendar that colour-codes each day by attendance status
// so an employee can see at a glance when they attended / were late /
// absent, with Fridays marked as the weekly holiday.
export function AttendanceCalendar({ records }: { records: Rec[] }) {
  const [month, setMonth] = useState<Date>(new Date());

  const buckets = useMemo(() => {
    const present: Date[] = [];
    const late: Date[] = [];
    const absent: Date[] = [];
    const holidayWorked: Date[] = [];
    for (const r of records) {
      const d = new Date(r.date);
      if (r.isHoliday && r.checkIn) holidayWorked.push(d);
      else if (r.status === "late") late.push(d);
      else if (r.status === "absent") absent.push(d);
      else if (r.status === "present" || r.checkIn) present.push(d);
    }
    return { present, late, absent, holidayWorked };
  }, [records]);

  return (
    <div className="space-y-3">
      <Calendar
        mode="default"
        month={month}
        onMonthChange={setMonth}
        showOutsideDays
        modifiers={{
          present: buckets.present,
          late: buckets.late,
          absent: buckets.absent,
          holidayWorked: buckets.holidayWorked,
          // Friday = weekly holiday (getDay 5).
          holiday: (d: Date) => d.getDay() === 5,
        }}
        modifiersClassNames={{
          present:
            "bg-success/20 text-success-foreground rounded-md font-medium",
          late: "bg-warning/30 text-warning-foreground rounded-md font-semibold ring-1 ring-warning",
          absent:
            "bg-destructive/20 text-destructive rounded-md font-semibold",
          holidayWorked:
            "bg-primary/20 text-primary rounded-md font-semibold ring-1 ring-primary",
          holiday: "text-muted-foreground/60",
        }}
      />
      <AttendanceLegend />
    </div>
  );
}

// Status colour key. Reused on its own (e.g. below the admin records table)
// where the calendar isn't shown.
export function AttendanceLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
      <Legend className="bg-success/30" label="Present" />
      <Legend className="bg-warning/40 ring-1 ring-warning" label="Late" />
      <Legend className="bg-destructive/30" label="Absent" />
      <Legend
        className="bg-primary/30 ring-1 ring-primary"
        label="Holiday worked (extra duty)"
      />
      <span className="text-muted-foreground/70">· Fridays = weekly holiday</span>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${className}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
