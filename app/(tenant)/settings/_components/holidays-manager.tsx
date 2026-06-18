"use client";

// Admin holiday calendar — configurable weekend (any days) + custom holidays.

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Plus, Trash2, Sparkles } from "lucide-react";
import {
  createHolidayAction,
  deleteHolidayAction,
  setWeekendAction,
  seedBangladeshAction,
} from "../holiday-actions";

const WEEKDAYS = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

export type HolidayRow = {
  id: string;
  date: string; // ISO
  name: string;
  type: string;
  isRecurring: boolean;
};

export function HolidaysManager({
  holidays,
  weekendDays,
}: {
  holidays: HolidayRow[];
  weekendDays: number[];
}) {
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<number[]>(weekendDays);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed");
    });
  }

  function toggleDay(v: number) {
    const next = days.includes(v) ? days.filter((d) => d !== v) : [...days, v];
    setDays(next);
    run(() => setWeekendAction(next));
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Weekend configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" />
            Weekly off days
          </CardTitle>
          <CardDescription>
            Pick the days your office is closed each week. Default for Bangladesh is Friday — but
            set any combination your management uses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.v}
                type="button"
                disabled={pending}
                onClick={() => toggleDay(d.v)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  days.includes(d.v)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add holiday */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays</CardTitle>
          <CardDescription>
            Add public/religious/company holidays. For Bangladesh, fixed-date holidays can recur
            every year; moon-sighting holidays (Eid, etc.) should be added per year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={(fd) => run(() => createHolidayAction(fd))}
            className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs">Date</Label>
              <DatePicker id="date" name="date" required placeholder="Select date" showPresets />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Name</Label>
              <Input id="name" name="name" required placeholder="Eid-ul-Fitr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select name="type" defaultValue="public">
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="religious">Religious</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-xs">
              <input type="checkbox" name="isRecurring" className="rounded" />
              Yearly
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => seedBangladeshAction())}
            >
              <Sparkles className="h-4 w-4" /> Seed Bangladesh national holidays
            </Button>
          </div>

          {/* List */}
          {holidays.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              No holidays yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-24 text-xs font-medium tabular-nums">
                    {new Date(h.date).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      ...(h.isRecurring ? {} : { year: "numeric" }),
                    })}
                  </span>
                  <span className="flex-1 text-sm">{h.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{h.type}</Badge>
                  {h.isRecurring && (
                    <Badge variant="outline" className="text-[10px]">yearly</Badge>
                  )}
                  <button
                    type="button"
                    aria-label="Delete holiday"
                    disabled={pending}
                    onClick={() => run(() => deleteHolidayAction(h.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}