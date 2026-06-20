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
import { Plus, Trash2, CheckCircle2, Moon, UserCheck } from "lucide-react";
import {
  createHolidayAction,
  createHolidayRangeAction,
  deleteHolidayAction,
  deleteHolidaysAction,
  confirmHolidaysAction,
} from "../holiday-actions";
import { HolidayApplyDialog, type ApplyGroup } from "./holiday-apply-dialog";

export type HolidayRow = {
  id: string;
  date: string; // ISO
  name: string;
  type: string;
  isRecurring: boolean;
  isTentative: boolean;
};

// Group rows that share a name + recurrence into one block (a multi-day Eid
// window), sorted by first date. Single holidays become a 1-row group.
function groupHolidays(rows: HolidayRow[]) {
  const map = new Map<string, HolidayRow[]>();
  for (const h of rows) {
    const key = `${h.name}__${h.isRecurring}`;
    const arr = map.get(key);
    if (arr) arr.push(h);
    else map.set(key, [h]);
  }
  return [...map.values()]
    .map((g) => g.slice().sort((a, b) => +new Date(a.date) - +new Date(b.date)))
    .sort((a, b) => +new Date(a[0].date) - +new Date(b[0].date));
}

function fmtDay(iso: string, withYear: boolean) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function HolidaysManager({
  holidays,
  appliedCounts,
}: {
  holidays: HolidayRow[];
  appliedCounts: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [multiDay, setMultiDay] = useState(false);
  const [applyGroup, setApplyGroup] = useState<ApplyGroup | null>(null);
  const groups = groupHolidays(holidays);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed");
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Add holiday */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays</CardTitle>
          <CardDescription>
            Holidays are a library — adding one does <span className="font-medium text-foreground">not</span> give anyone a
            day off until you press <span className="font-medium text-foreground">Apply</span> and pick the employees. So Eid
            or a national holiday can go to different people on different dates. Use
            <span className="font-medium text-foreground"> Multi-day</span> for an Eid window and
            <span className="font-medium text-foreground"> Tentative</span> until the moon-sighting date is confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={(fd) => run(() => (multiDay ? createHolidayRangeAction(fd) : createHolidayAction(fd)))}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40 space-y-1.5">
                <Label htmlFor="date" className="text-xs">{multiDay ? "Start date" : "Date"}</Label>
                <DatePicker id="date" name="date" required placeholder="Select date" showPresets />
              </div>
              {multiDay && (
                <div className="w-40 space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs">End date</Label>
                  <DatePicker id="endDate" name="endDate" required placeholder="Select date" showPresets />
                </div>
              )}
              <div className="min-w-[180px] flex-1 space-y-1.5">
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
              <Button type="submit" size="sm" disabled={pending}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={multiDay}
                  onChange={(e) => setMultiDay(e.target.checked)}
                  className="rounded"
                />
                <Moon className="h-3.5 w-3.5 text-primary" />
                Multi-day (Eid window)
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" name="isTentative" className="rounded" />
                Tentative — date not yet confirmed
              </label>
              {!multiDay && (
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" name="isRecurring" className="rounded" />
                  Yearly (fixed date)
                </label>
              )}
            </div>
          </form>

          {/* List — multi-day blocks (Eid) grouped into one row */}
          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              No holidays yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
              {groups.map((g) => {
                const first = g[0];
                const last = g[g.length - 1];
                const multi = g.length > 1;
                const ids = g.map((h) => h.id);
                const anyTentative = g.some((h) => h.isTentative);
                const appliedTo = appliedCounts[first.id] ?? 0;
                const dateLabel = multi
                  ? `${fmtDay(first.date, false)} – ${fmtDay(last.date, !first.isRecurring)}`
                  : fmtDay(first.date, !first.isRecurring);
                return (
                  <li
                    key={`${first.name}-${first.isRecurring}-${first.id}`}
                    className="flex flex-col gap-2 p-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3 lg:gap-y-2 lg:py-2"
                  >
                    {/* date + name: stacked card header on mobile, inline on desktop */}
                    <div className="flex min-w-0 items-baseline gap-2 lg:contents">
                      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground lg:w-32 lg:text-foreground">{dateLabel}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium lg:min-w-[110px] lg:font-normal">{first.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {multi && (
                        <Badge variant="outline" className="text-[10px]">{g.length} days</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] capitalize">{first.type}</Badge>
                      {first.isRecurring && <Badge variant="outline" className="text-[10px]">yearly</Badge>}
                      {anyTentative && (
                        <Badge className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                          <Moon className="h-3 w-3" /> tentative
                        </Badge>
                      )}
                      {appliedTo > 0 ? (
                        <Badge className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
                          <UserCheck className="h-3 w-3" /> {appliedTo} applied
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">not applied</Badge>
                      )}
                    </div>
                    {/* Actions — full-width row on mobile card, right-aligned on desktop. */}
                    <div className="flex items-center gap-1.5 lg:ml-auto lg:shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 flex-1 gap-1 px-3 text-xs lg:flex-none"
                        onClick={() => setApplyGroup({ ids, name: first.name, dateLabel })}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Apply to staff
                      </Button>
                      {anyTentative && (
                        <button
                          type="button"
                          title="Confirm — dates are now final"
                          disabled={pending}
                          onClick={() => run(() => confirmHolidaysAction(ids))}
                          className="text-muted-foreground hover:text-emerald-600"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={multi ? "Delete all days" : "Delete holiday"}
                        title={multi ? "Remove all days" : "Remove"}
                        disabled={pending}
                        onClick={() =>
                          run(() => (multi ? deleteHolidaysAction(ids) : deleteHolidayAction(first.id)))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <HolidayApplyDialog group={applyGroup} onClose={() => setApplyGroup(null)} />
    </div>
  );
}